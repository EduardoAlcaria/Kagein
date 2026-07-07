package com.kagein.springbff.alert;

import com.kagein.springbff.domain.AlertEvent;
import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.AlertEventRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class StaleUpdateAlertService {

    private final PersonLocationRepository personLocationRepository;
    private final AlertEventRepository alertEventRepository;

    @Value("${alert.stale-threshold-hours:6}")
    private long staleThresholdHours;

    public StaleUpdateAlertService(
            PersonLocationRepository personLocationRepository,
            AlertEventRepository alertEventRepository) {
        this.personLocationRepository = personLocationRepository;
        this.alertEventRepository = alertEventRepository;
    }

    public void checkPerson(Person person) {
        List<PersonLocation> locations =
                personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(person.getId());
        if (locations.isEmpty()) {
            return;
        }
        PersonLocation latest = locations.get(0);
        boolean isStale = latest.getCapturedAt().isBefore(Instant.now().minus(staleThresholdHours, ChronoUnit.HOURS));
        if (!isStale) {
            return;
        }
        boolean alreadyFiredForThisEpisode = alertEventRepository.findTop100ByOrderByTriggeredAtDesc().stream()
                .anyMatch(event -> event.getPersonId().equals(person.getId())
                        && event.getType().equals("STALE_UPDATE")
                        && event.getTriggeredAt().isAfter(latest.getCapturedAt()));
        if (alreadyFiredForThisEpisode) {
            return;
        }
        alertEventRepository.save(AlertEvent.builder()
                .personId(person.getId())
                .type("STALE_UPDATE")
                .message(person.getName() + " hasn't shared an updated location in over "
                        + staleThresholdHours + " hours")
                .triggeredAt(Instant.now())
                .build());
    }
}
