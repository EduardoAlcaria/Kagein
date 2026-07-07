package com.kagein.springbff.poll;

import com.kagein.springbff.client.PersonDto;
import com.kagein.springbff.client.PythonFindMyClient;
import com.kagein.springbff.domain.*;
import com.kagein.springbff.repository.*;
import com.kagein.springbff.security.CredentialCipher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PollingServiceTest {

    @Mock private PythonFindMyClient pythonFindMyClient;
    @Mock private CredentialCipher credentialCipher;
    @Mock private FmAccountRepository fmAccountRepository;
    @Mock private PersonRepository personRepository;
    @Mock private PersonLocationRepository personLocationRepository;

    @InjectMocks
    private PollingService pollingService;

    @Test
    void pollAccountCreatesNewPersonAndLocationOnFirstSighting() {
        FmAccount account = FmAccount.builder()
                .id(1L).appleId("user@example.com")
                .encryptedPassword("enc").status(AccountStatus.ACTIVE).build();
        when(credentialCipher.decrypt("enc")).thenReturn("hunter2");
        when(pythonFindMyClient.getPeople("user@example.com", "hunter2"))
                .thenReturn(List.of(new PersonDto("friend-1", "Jane Doe", 37.33, -122.0, 1586034872142L)));
        when(personRepository.findByFmAccountIdAndExternalId(1L, "friend-1")).thenReturn(Optional.empty());
        when(personRepository.save(any())).thenAnswer(inv -> {
            Person p = inv.getArgument(0);
            p.setId(10L);
            return p;
        });

        pollingService.pollAccount(account);

        verify(personRepository).save(argThat(p ->
                p.getFmAccountId().equals(1L) && p.getExternalId().equals("friend-1") && p.getName().equals("Jane Doe")));
        verify(personLocationRepository).save(argThat(loc ->
                loc.getPersonId().equals(10L) && loc.getLatitude().equals(37.33)));
    }

    @Test
    void pollAccountReusesExistingPersonOnSubsequentSighting() {
        FmAccount account = FmAccount.builder()
                .id(1L).appleId("user@example.com")
                .encryptedPassword("enc").status(AccountStatus.ACTIVE).build();
        Person existing = Person.builder().id(10L).fmAccountId(1L).externalId("friend-1").name("Jane Doe").build();
        when(credentialCipher.decrypt("enc")).thenReturn("hunter2");
        when(pythonFindMyClient.getPeople("user@example.com", "hunter2"))
                .thenReturn(List.of(new PersonDto("friend-1", "Jane Doe", 37.34, -122.1, 1586034900000L)));
        when(personRepository.findByFmAccountIdAndExternalId(1L, "friend-1")).thenReturn(Optional.of(existing));

        pollingService.pollAccount(account);

        verify(personRepository, never()).save(any());
        verify(personLocationRepository).save(argThat(loc -> loc.getPersonId().equals(10L)));
    }

    @Test
    void pollAllActiveAccountsOnlyPollsActiveOnes() {
        FmAccount active = FmAccount.builder()
                .id(1L).appleId("a@example.com").encryptedPassword("enc")
                .status(AccountStatus.ACTIVE).build();
        when(fmAccountRepository.findByStatus(AccountStatus.ACTIVE)).thenReturn(List.of(active));
        when(credentialCipher.decrypt("enc")).thenReturn("hunter2");
        when(pythonFindMyClient.getPeople(any(), any())).thenReturn(List.of());

        pollingService.pollAllActiveAccounts();

        verify(pythonFindMyClient).getPeople("a@example.com", "hunter2");
    }

    @Test
    void pollAllActiveAccountsContinuesAfterOneAccountFails() {
        FmAccount accountA = FmAccount.builder()
                .id(1L).appleId("a@example.com").encryptedPassword("encA")
                .status(AccountStatus.ACTIVE).build();
        FmAccount accountB = FmAccount.builder()
                .id(2L).appleId("b@example.com").encryptedPassword("encB")
                .status(AccountStatus.ACTIVE).build();
        when(fmAccountRepository.findByStatus(AccountStatus.ACTIVE)).thenReturn(List.of(accountA, accountB));
        when(credentialCipher.decrypt("encA")).thenReturn("passA");
        when(credentialCipher.decrypt("encB")).thenReturn("passB");
        when(pythonFindMyClient.getPeople("a@example.com", "passA"))
                .thenThrow(new RuntimeException("network blip"));
        when(pythonFindMyClient.getPeople("b@example.com", "passB")).thenReturn(List.of());

        pollingService.pollAllActiveAccounts();

        verify(pythonFindMyClient).getPeople("b@example.com", "passB");
    }
}
