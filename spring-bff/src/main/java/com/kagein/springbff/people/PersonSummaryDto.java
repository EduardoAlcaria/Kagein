package com.kagein.springbff.people;

public record PersonSummaryDto(Long id, String name, PersonLocationDto latest) {
}
