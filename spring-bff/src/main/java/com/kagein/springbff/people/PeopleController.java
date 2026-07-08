package com.kagein.springbff.people;

import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.PersonLocationRepository;
import com.kagein.springbff.repository.PersonRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/people")
public class PeopleController {

    private final PersonRepository personRepository;
    private final PersonLocationRepository personLocationRepository;

    public PeopleController(PersonRepository personRepository, PersonLocationRepository personLocationRepository) {
        this.personRepository = personRepository;
        this.personLocationRepository = personLocationRepository;
    }

    @GetMapping
    public List<PersonSummaryDto> listPeople() {
        return personRepository.findAll().stream()
                .map(person -> {
                    List<PersonLocation> locations =
                            personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(person.getId());
                    PersonLocationDto latest = locations.isEmpty() ? null : toDto(locations.get(0));
                    return new PersonSummaryDto(person.getId(), person.getName(), latest);
                })
                .toList();
    }

    @GetMapping("/{id}/locations")
    public List<PersonLocationDto> listLocations(@PathVariable Long id) {
        return personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(id).stream()
                .map(this::toDto)
                .toList();
    }

    private PersonLocationDto toDto(PersonLocation location) {
        return new PersonLocationDto(location.getLatitude(), location.getLongitude(), location.getCapturedAt());
    }
}
