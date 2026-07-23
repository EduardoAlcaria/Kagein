package com.kagein.springbff.zone;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.PointOfInterest;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PointOfInterestRepository;
import com.kagein.springbff.repository.ZoneRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm",
        "credential.encryption-key=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
})
class ZoneControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired private MockMvc mockMvc;
    @Autowired private FmAccountRepository fmAccountRepository;
    @Autowired private PointOfInterestRepository pointRepository;
    @Autowired private ZoneRepository zoneRepository;

    @BeforeEach
    void clean() {
        zoneRepository.deleteAll();
        pointRepository.deleteAll();
        fmAccountRepository.deleteAll();
    }

    private Long seedPoi() {
        FmAccount account = fmAccountRepository.save(FmAccount.builder().appleId("a@icloud.com")
                .encryptedPassword("x").status(AccountStatus.ACTIVE).createdAt(Instant.now()).build());
        return pointRepository.save(PointOfInterest.builder().fmAccountId(account.getId())
                .label("Home").latitude(-23.56).longitude(-46.65).createdAt(Instant.now()).build()).getId();
    }

    @Test
    void createsACircleZone() throws Exception {
        Long poiId = seedPoi();

        mockMvc.perform(post("/api/zones").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"poiId\":" + poiId + ",\"shape\":\"CIRCLE\",\"radiusMeters\":50,"
                                + "\"trigger\":\"ENTER\",\"color\":\"#f00\",\"alarmMessage\":\"near home\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shape").value("CIRCLE"))
                .andExpect(jsonPath("$.radiusMeters").value(50));

        mockMvc.perform(get("/api/zones").with(httpBasic("admin", "hunter2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].trigger").value("ENTER"));
    }

    @Test
    void rejectsCircleWithoutRadius() throws Exception {
        Long poiId = seedPoi();

        mockMvc.perform(post("/api/zones").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"poiId\":" + poiId + ",\"shape\":\"CIRCLE\","
                                + "\"trigger\":\"ENTER\",\"color\":\"#f00\",\"alarmMessage\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsPolygonWithTooFewVertices() throws Exception {
        Long poiId = seedPoi();

        mockMvc.perform(post("/api/zones").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"poiId\":" + poiId + ",\"shape\":\"POLYGON\","
                                + "\"vertices\":\"[[0,0],[1,1]]\","
                                + "\"trigger\":\"INSIDE\",\"color\":\"#f00\",\"alarmMessage\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }
}
