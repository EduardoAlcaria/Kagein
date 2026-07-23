package com.kagein.springbff.zone;

public record ZoneDto(Long id, Long poiId, String shape, Integer radiusMeters,
                      String vertices, String trigger, String color, String alarmMessage) {
}
