package com.kagein.springbff.people;

import java.time.Instant;

public record PersonLocationDto(Double latitude, Double longitude, Instant capturedAt) {
}
