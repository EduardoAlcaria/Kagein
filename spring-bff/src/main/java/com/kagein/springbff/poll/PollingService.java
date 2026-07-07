package com.kagein.springbff.poll;

import com.kagein.springbff.client.PersonDto;
import com.kagein.springbff.client.PythonFindMyClient;
import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import com.kagein.springbff.repository.PersonRepository;
import com.kagein.springbff.security.CredentialCipher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class PollingService {

    private final PythonFindMyClient pythonFindMyClient;
    private final CredentialCipher credentialCipher;
    private final FmAccountRepository fmAccountRepository;
    private final PersonRepository personRepository;
    private final PersonLocationRepository personLocationRepository;

    public PollingService(
            PythonFindMyClient pythonFindMyClient,
            CredentialCipher credentialCipher,
            FmAccountRepository fmAccountRepository,
            PersonRepository personRepository,
            PersonLocationRepository personLocationRepository) {
        this.pythonFindMyClient = pythonFindMyClient;
        this.credentialCipher = credentialCipher;
        this.fmAccountRepository = fmAccountRepository;
        this.personRepository = personRepository;
        this.personLocationRepository = personLocationRepository;
    }

    @Scheduled(fixedDelayString = "${polling.interval-ms:60000}")
    public void pollAllActiveAccounts() {
        for (FmAccount account : fmAccountRepository.findByStatus(AccountStatus.ACTIVE)) {
            pollAccount(account);
        }
    }

    public void pollAccount(FmAccount account) {
        String password = credentialCipher.decrypt(account.getEncryptedPassword());
        for (PersonDto dto : pythonFindMyClient.getPeople(account.getAppleId(), password)) {
            Person person = personRepository.findByFmAccountIdAndExternalId(account.getId(), dto.id())
                    .orElseGet(() -> personRepository.save(Person.builder()
                            .fmAccountId(account.getId())
                            .externalId(dto.id())
                            .name(dto.name())
                            .build()));
            if (dto.latitude() != null && dto.longitude() != null) {
                personLocationRepository.save(PersonLocation.builder()
                        .personId(person.getId())
                        .latitude(dto.latitude())
                        .longitude(dto.longitude())
                        .capturedAt(dto.timestampMs() != null
                                ? Instant.ofEpochMilli(dto.timestampMs())
                                : Instant.now())
                        .build());
            }
        }
    }
}
