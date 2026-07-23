package com.kagein.springbff.alert;

import com.kagein.springbff.domain.*;
import com.kagein.springbff.repository.*;
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
class ZoneAlertServiceTest {

    @Mock private PointOfInterestRepository pointRepository;
    @Mock private ZoneRepository zoneRepository;
    @Mock private PersonRepository personRepository;
    @Mock private PersonLocationRepository personLocationRepository;
    @Mock private AlertEventRepository alertEventRepository;

    @InjectMocks
    private ZoneAlertService service;

    private void setThresholds() {
        ReflectionTestUtils.setField(service, "freshnessWindowMin", 15L);
        ReflectionTestUtils.setField(service, "movementThresholdM", 30.0);
    }

    private FmAccount account() {
        return FmAccount.builder().id(1L).appleId("a@icloud.com").build();
    }

    private PointOfInterest poi() {
        return PointOfInterest.builder().id(100L).fmAccountId(1L).label("Home")
                .latitude(-23.560).longitude(-46.650).createdAt(Instant.now()).build();
    }

    private Zone circle(ZoneTrigger trigger) {
        return Zone.builder().id(200L).poiId(100L).shape(ZoneShape.CIRCLE)
                .radiusMeters(50).trigger(trigger).color("#f00").alarmMessage("In zone")
                .createdAt(Instant.now()).build();
    }

    private Person person() {
        return Person.builder().id(10L).fmAccountId(1L).externalId("f1").name("Jane").build();
    }

    private PersonLocation loc(double lat, double lon, int minutesAgo) {
        return PersonLocation.builder().id(1L).personId(10L).latitude(lat).longitude(lon)
                .capturedAt(Instant.now().minus(minutesAgo, ChronoUnit.MINUTES)).build();
    }

    @Test
    void firesEnterWhenPersonCrossesIntoCircle() {
        setThresholds();
        when(pointRepository.findByFmAccountId(1L)).thenReturn(List.of(poi()));
        when(zoneRepository.findByPoiIdIn(List.of(100L))).thenReturn(List.of(circle(ZoneTrigger.ENTER)));
        when(personRepository.findByFmAccountId(1L)).thenReturn(List.of(person()));
        // current inside (same point as POI), previous far away — and moving with a fresh fix.
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(loc(-23.560, -46.650, 1), loc(-23.500, -46.600, 5)));

        service.checkAccount(account());

        verify(alertEventRepository).save(argThat(e ->
                e.getPersonId().equals(10L) && e.getZoneId().equals(200L)
                        && e.getType().equals("ENTER")));
    }

    @Test
    void doesNotFireEnterWhenAlreadyInsidePreviously() {
        setThresholds();
        when(pointRepository.findByFmAccountId(1L)).thenReturn(List.of(poi()));
        when(zoneRepository.findByPoiIdIn(List.of(100L))).thenReturn(List.of(circle(ZoneTrigger.ENTER)));
        when(personRepository.findByFmAccountId(1L)).thenReturn(List.of(person()));
        // both fixes inside — no transition.
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(loc(-23.560, -46.650, 1), loc(-23.5601, -46.6501, 5)));

        service.checkAccount(account());

        verify(alertEventRepository, never()).save(any());
    }

    @Test
    void firesInsideEveryPollWhileInside() {
        setThresholds();
        when(pointRepository.findByFmAccountId(1L)).thenReturn(List.of(poi()));
        when(zoneRepository.findByPoiIdIn(List.of(100L))).thenReturn(List.of(circle(ZoneTrigger.INSIDE)));
        when(personRepository.findByFmAccountId(1L)).thenReturn(List.of(person()));
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(loc(-23.560, -46.650, 1)));

        service.checkAccount(account());

        verify(alertEventRepository).save(argThat(e -> e.getType().equals("INSIDE")));
    }

    @Test
    void skipsMovingPersonWithStaleFix() {
        setThresholds();
        when(pointRepository.findByFmAccountId(1L)).thenReturn(List.of(poi()));
        when(zoneRepository.findByPoiIdIn(List.of(100L))).thenReturn(List.of(circle(ZoneTrigger.INSIDE)));
        when(personRepository.findByFmAccountId(1L)).thenReturn(List.of(person()));
        // current fix inside but 40 min old, and the person moved far since — untrusted.
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(loc(-23.560, -46.650, 40), loc(-23.400, -46.500, 55)));

        service.checkAccount(account());

        verify(alertEventRepository, never()).save(any());
    }
}
