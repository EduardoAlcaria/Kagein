package com.kagein.springbff.alert;

import java.time.Instant;

public record AlertEventDto(Long id, Long personId, Long zoneId, String type, String message, Instant triggeredAt) {
}
