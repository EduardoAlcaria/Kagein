package com.kagein.springbff.alert;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.kagein.springbff.domain.*;
import com.kagein.springbff.geo.Geometry;
import com.kagein.springbff.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ZoneAlertService {

    private static final Logger log = LoggerFactory.getLogger(ZoneAlertService.class);

    private final PointOfInterestRepository pointRepository;
    private final ZoneRepository zoneRepository;
    private final PersonRepository personRepository;
    private final PersonLocationRepository personLocationRepository;
    private final AlertEventRepository alertEventRepository;
    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    @Value("${zone.freshness-window-min:15}")
    private long freshnessWindowMin;
    @Value("${zone.movement-threshold-m:30}")
    private double movementThresholdM;

    public ZoneAlertService(
            PointOfInterestRepository pointRepository,
            ZoneRepository zoneRepository,
            PersonRepository personRepository,
            PersonLocationRepository personLocationRepository,
            AlertEventRepository alertEventRepository) {
        this.pointRepository = pointRepository;
        this.zoneRepository = zoneRepository;
        this.personRepository = personRepository;
        this.personLocationRepository = personLocationRepository;
        this.alertEventRepository = alertEventRepository;
    }

    public void checkAccount(FmAccount account) {
        List<PointOfInterest> pois = pointRepository.findByFmAccountId(account.getId());
        if (pois.isEmpty()) {
            return;
        }
        Map<Long, PointOfInterest> poiById = pois.stream()
                .collect(Collectors.toMap(PointOfInterest::getId, Function.identity()));
        List<Zone> zones = zoneRepository.findByPoiIdIn(pois.stream().map(PointOfInterest::getId).toList());
        if (zones.isEmpty()) {
            return;
        }

        for (Person person : personRepository.findByFmAccountId(account.getId())) {
            List<PersonLocation> locations =
                    personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(person.getId());
            if (locations.isEmpty() || locations.get(0).getLatitude() == null) {
                continue;
            }
            PersonLocation current = locations.get(0);
            PersonLocation previous = locations.size() > 1 ? locations.get(1) : null;

            if (isMoving(current, previous) && isStale(current)) {
                continue;
            }

            for (Zone zone : zones) {
                PointOfInterest poi = poiById.get(zone.getPoiId());
                if (poi == null) {
                    continue;
                }
                boolean insideNow = isInside(zone, poi, current);
                boolean insidePrev = previous != null && previous.getLatitude() != null
                        && isInside(zone, poi, previous);
                if (shouldFire(zone.getTrigger(), insideNow, insidePrev)) {
                    alertEventRepository.save(AlertEvent.builder()
                            .personId(person.getId())
                            .zoneId(zone.getId())
                            .type(zone.getTrigger().name())
                            .message(person.getName() + ": " + zone.getAlarmMessage())
                            .triggeredAt(Instant.now())
                            .build());
                }
            }
        }
    }

    private boolean shouldFire(ZoneTrigger trigger, boolean insideNow, boolean insidePrev) {
        return switch (trigger) {
            case ENTER -> insideNow && !insidePrev;
            case LEAVE -> !insideNow && insidePrev;
            case INSIDE -> insideNow;
        };
    }

    private boolean isInside(Zone zone, PointOfInterest poi, PersonLocation loc) {
        double lat = loc.getLatitude();
        double lon = loc.getLongitude();
        if (zone.getShape() == ZoneShape.CIRCLE) {
            double d = Geometry.distanceMeters(lat, lon, poi.getLatitude(), poi.getLongitude());
            return d <= zone.getRadiusMeters();
        }
        try {
            double[][] vertices = objectMapper.readValue(zone.getVertices(), double[][].class);
            return Geometry.pointInPolygon(lat, lon, vertices);
        } catch (Exception e) {
            log.error("Bad polygon vertices for zone {}", zone.getId(), e);
            return false;
        }
    }

    // Moving = displacement between the two most recent fixes exceeds the
    // threshold. A person with only one fix, or who barely moved, is treated
    // as stationary (and thus their last position is trusted even if old).
    private boolean isMoving(PersonLocation current, PersonLocation previous) {
        if (previous == null || previous.getLatitude() == null) {
            return false;
        }
        double d = Geometry.distanceMeters(
                current.getLatitude(), current.getLongitude(),
                previous.getLatitude(), previous.getLongitude());
        return d > movementThresholdM;
    }

    private boolean isStale(PersonLocation current) {
        return current.getCapturedAt().isBefore(Instant.now().minus(freshnessWindowMin, ChronoUnit.MINUTES));
    }
}
