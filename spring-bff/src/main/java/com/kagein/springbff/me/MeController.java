package com.kagein.springbff.me;

import com.kagein.springbff.alert.ZoneAlertService;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import com.kagein.springbff.repository.PersonRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private static final String SELF_EXTERNAL_ID = "self";
    private static final String SELF_NAME = "Me";

    private final FmAccountRepository fmAccountRepository;
    private final PersonRepository personRepository;
    private final PersonLocationRepository personLocationRepository;
    private final ZoneAlertService zoneAlertService;

    public MeController(
            FmAccountRepository fmAccountRepository,
            PersonRepository personRepository,
            PersonLocationRepository personLocationRepository,
            ZoneAlertService zoneAlertService) {
        this.fmAccountRepository = fmAccountRepository;
        this.personRepository = personRepository;
        this.personLocationRepository = personLocationRepository;
        this.zoneAlertService = zoneAlertService;
    }

    @PostMapping("/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateLocation(@RequestBody UpdateMyLocationRequest request) {
        if (request.latitude() == null || request.longitude() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "latitude and longitude required");
        }
        FmAccount account = fmAccountRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "no account configured"));
        Person self = personRepository.findByFmAccountIdAndExternalId(account.getId(), SELF_EXTERNAL_ID)
                .orElseGet(() -> personRepository.save(Person.builder()
                        .fmAccountId(account.getId())
                        .externalId(SELF_EXTERNAL_ID)
                        .name(SELF_NAME)
                        .build()));
        personLocationRepository.save(PersonLocation.builder()
                .personId(self.getId())
                .latitude(request.latitude())
                .longitude(request.longitude())
                .capturedAt(Instant.now())
                .build());
        zoneAlertService.checkAccount(account);
    }
}
