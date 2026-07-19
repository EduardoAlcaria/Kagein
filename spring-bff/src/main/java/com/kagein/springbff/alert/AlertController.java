package com.kagein.springbff.alert;

import com.kagein.springbff.repository.AlertEventRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertEventRepository alertEventRepository;

    public AlertController(AlertEventRepository alertEventRepository) {
        this.alertEventRepository = alertEventRepository;
    }

    @GetMapping
    public List<AlertEventDto> listAlerts() {
        return alertEventRepository.findTop100ByOrderByTriggeredAtDesc().stream()
                .map(event -> new AlertEventDto(
                        event.getId(), event.getPersonId(), event.getZoneId(), event.getType(),
                        event.getMessage(), event.getTriggeredAt()))
                .toList();
    }
}
