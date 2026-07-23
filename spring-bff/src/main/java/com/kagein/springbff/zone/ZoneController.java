package com.kagein.springbff.zone;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.kagein.springbff.domain.Zone;
import com.kagein.springbff.domain.ZoneShape;
import com.kagein.springbff.domain.ZoneTrigger;
import com.kagein.springbff.repository.PointOfInterestRepository;
import com.kagein.springbff.repository.ZoneRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/zones")
public class ZoneController {

    private final ZoneRepository zoneRepository;
    private final PointOfInterestRepository pointRepository;
    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    public ZoneController(ZoneRepository zoneRepository, PointOfInterestRepository pointRepository) {
        this.zoneRepository = zoneRepository;
        this.pointRepository = pointRepository;
    }

    @GetMapping
    public List<ZoneDto> list() {
        return zoneRepository.findAll().stream().map(this::toDto).toList();
    }

    @PostMapping
    public ZoneDto create(@RequestBody CreateZoneRequest request) {
        if (request.poiId() == null || pointRepository.findById(request.poiId()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown poiId");
        }
        ZoneShape shape = parseEnum(ZoneShape.class, request.shape(), "shape");
        ZoneTrigger trigger = parseEnum(ZoneTrigger.class, request.trigger(), "trigger");
        if (request.color() == null || request.color().isBlank()
                || request.alarmMessage() == null || request.alarmMessage().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "color and alarmMessage required");
        }
        if (shape == ZoneShape.CIRCLE) {
            if (request.radiusMeters() == null || request.radiusMeters() < 1 || request.radiusMeters() > 100_000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "radiusMeters 1..100000 required");
            }
        } else {
            validatePolygon(request.vertices());
        }
        Zone saved = zoneRepository.save(Zone.builder()
                .poiId(request.poiId())
                .shape(shape)
                .radiusMeters(shape == ZoneShape.CIRCLE ? request.radiusMeters() : null)
                .vertices(shape == ZoneShape.POLYGON ? request.vertices() : null)
                .trigger(trigger)
                .color(request.color())
                .alarmMessage(request.alarmMessage())
                .createdAt(Instant.now())
                .build());
        return toDto(saved);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        zoneRepository.deleteById(id);
    }

    private void validatePolygon(String vertices) {
        try {
            double[][] parsed = objectMapper.readValue(vertices, double[][].class);
            if (parsed.length < 3) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "polygon needs >= 3 vertices");
            }
            for (double[] pair : parsed) {
                if (pair.length != 2) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "each vertex is [lat, lon]");
                }
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid vertices JSON");
        }
    }

    private <E extends Enum<E>> E parseEnum(Class<E> type, String value, String field) {
        try {
            return Enum.valueOf(type, value);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid " + field);
        }
    }

    private ZoneDto toDto(Zone z) {
        return new ZoneDto(z.getId(), z.getPoiId(), z.getShape().name(), z.getRadiusMeters(),
                z.getVertices(), z.getTrigger().name(), z.getColor(), z.getAlarmMessage());
    }
}
