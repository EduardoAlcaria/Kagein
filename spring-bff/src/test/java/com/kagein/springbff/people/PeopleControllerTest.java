package com.kagein.springbff.people;

import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.PersonLocationRepository;
import com.kagein.springbff.repository.PersonRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm",
        "credential.encryption-key=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
})
class PeopleControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PersonRepository personRepository;

    @MockitoBean
    private PersonLocationRepository personLocationRepository;

    @Test
    void listPeopleReturnsEachPersonWithLatestLocation() throws Exception {
        Person jane = Person.builder().id(10L).fmAccountId(1L).externalId("friend-1").name("Jane Doe").build();
        when(personRepository.findAll()).thenReturn(List.of(jane));
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L)).thenReturn(List.of(
                PersonLocation.builder().id(1L).personId(10L).latitude(37.33).longitude(-122.0)
                        .capturedAt(Instant.parse("2026-07-06T12:00:00Z")).build()));

        mockMvc.perform(get("/api/people").with(httpBasic("admin", "hunter2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Jane Doe"))
                .andExpect(jsonPath("$[0].latest.latitude").value(37.33));
    }

    @Test
    void listLocationsReturnsHistoryMostRecentFirst() throws Exception {
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L)).thenReturn(List.of(
                PersonLocation.builder().id(2L).personId(10L).latitude(37.34).longitude(-122.1)
                        .capturedAt(Instant.parse("2026-07-06T13:00:00Z")).build(),
                PersonLocation.builder().id(1L).personId(10L).latitude(37.33).longitude(-122.0)
                        .capturedAt(Instant.parse("2026-07-06T12:00:00Z")).build()));

        mockMvc.perform(get("/api/people/10/locations").with(httpBasic("admin", "hunter2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].latitude").value(37.34));
    }
}
