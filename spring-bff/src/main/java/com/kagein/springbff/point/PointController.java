package com.kagein.springbff.point;

import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.PointOfInterest;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PointOfInterestRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/points")
public class PointController {

    private final PointOfInterestRepository pointRepository;
    private final FmAccountRepository fmAccountRepository;

    public PointController(PointOfInterestRepository pointRepository, FmAccountRepository fmAccountRepository) {
        this.pointRepository = pointRepository;
        this.fmAccountRepository = fmAccountRepository;
    }

    @GetMapping
    public List<PointDto> list() {
        return pointRepository.findAll().stream()
                .map(p -> new PointDto(p.getId(), p.getLabel(), p.getLatitude(), p.getLongitude()))
                .toList();
    }

    @PostMapping
    public PointDto create(@RequestBody CreatePointRequest request) {
        if (request.label() == null || request.label().isBlank()
                || request.latitude() == null || request.longitude() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "label, latitude, longitude required");
        }
        FmAccount account = fmAccountRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "no account configured"));
        PointOfInterest saved = pointRepository.save(PointOfInterest.builder()
                .fmAccountId(account.getId())
                .label(request.label())
                .latitude(request.latitude())
                .longitude(request.longitude())
                .createdAt(Instant.now())
                .build());
        return new PointDto(saved.getId(), saved.getLabel(), saved.getLatitude(), saved.getLongitude());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        pointRepository.deleteById(id);
    }
}
