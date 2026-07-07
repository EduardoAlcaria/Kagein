package com.kagein.springbff.client;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PersonDto(
        String id,
        String name,
        Double latitude,
        Double longitude,
        @JsonProperty("timestamp_ms") Long timestampMs) {
}
