package com.kagein.springbff.repository;

import com.kagein.springbff.domain.Person;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PersonRepository extends JpaRepository<Person, Long> {
    Optional<Person> findByFmAccountIdAndExternalId(Long fmAccountId, String externalId);
    List<Person> findByFmAccountId(Long fmAccountId);
}
