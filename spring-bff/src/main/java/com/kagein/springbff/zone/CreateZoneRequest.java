package com.kagein.springbff.zone;

public record CreateZoneRequest(Long poiId, String shape, Integer radiusMeters,
                                String vertices, String trigger, String color, String alarmMessage) {
}
