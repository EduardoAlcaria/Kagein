package com.kagein.springbff.alert;

import com.kagein.springbff.domain.AlertEvent;
import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.AlertEventRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaleUpdateAlertServiceTest {

    @Mock private PersonLocationRepository personLocationRepository;
    @Mock private AlertEventRepository alertEventRepository;

    @InjectMocks
    private StaleUpdateAlertService alertService;

    private Person person(long id) {
        return Person.builder().id(id).fmAccountId(1L).externalId("friend-1").name("Jane Doe").build();
    }

    @Test
    void firesAlertWhenLatestLocationOlderThanThreshold() {
        ReflectionTestUtils.setField(alertService, "staleThresholdHours", 6L);
        PersonLocation stale = PersonLocation.builder()
                .id(1L).personId(10L)
                .capturedAt(Instant.now().minus(7, ChronoUnit.HOURS)).build();
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(stale));
        when(alertEventRepository.findTop100ByOrderByTriggeredAtDesc()).thenReturn(List.of());

        alertService.checkPerson(person(10L));

        verify(alertEventRepository).save(argThat(event ->
                event.getPersonId().equals(10L) && event.getType().equals("STALE_UPDATE")));
    }

    @Test
    void doesNotFireWhenLatestLocationIsRecent() {
        ReflectionTestUtils.setField(alertService, "staleThresholdHours", 6L);
        PersonLocation recent = PersonLocation.builder()
                .id(1L).personId(10L)
                .capturedAt(Instant.now().minus(1, ChronoUnit.HOURS)).build();
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(recent));

        alertService.checkPerson(person(10L));

        verify(alertEventRepository, never()).save(any());
    }

    @Test
    void doesNotFireASecondTimeForTheSameStalenessEpisode() {
        ReflectionTestUtils.setField(alertService, "staleThresholdHours", 6L);
        PersonLocation stale = PersonLocation.builder()
                .id(1L).personId(10L)
                .capturedAt(Instant.now().minus(7, ChronoUnit.HOURS)).build();
        AlertEvent alreadyFired = AlertEvent.builder()
                .id(1L).personId(10L).type("STALE_UPDATE").message("stale")
                .triggeredAt(Instant.now().minus(2, ChronoUnit.HOURS)).build();
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(stale));
        when(alertEventRepository.findTop100ByOrderByTriggeredAtDesc()).thenReturn(List.of(alreadyFired));

        alertService.checkPerson(person(10L));

        verify(alertEventRepository, never()).save(any());
    }
}
