# spring-bff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Java/Spring Boot backend-for-frontend that owns the dashboard's single-user auth, orchestrates `python-findmy-service` (account registration, 2FA relay, polling), persists people/location history/alerts in Postgres, and exposes the REST API the (not-yet-built) React frontend will consume.

**Architecture:** One Spring Boot 4 application, layered by feature rather than technical layer: `client` (talks to python-findmy-service), `domain`/`repository` (JPA + Flyway), `account` (registration/2FA), `poll` (scheduler that pulls people data), `alert` (stale-update detection), `people` (read API for the frontend), `security` (single-user session auth + credential encryption). Single user, no multi-tenant model — matches the rest of this project.

**Tech Stack:** Java 21, Spring Boot 4.1.0 (Spring Framework 7, Spring Security 7), Maven, Spring Data JPA + Flyway (PostgreSQL), Spring's `RestClient` for outbound HTTP (not `RestTemplate`, which Spring Framework 7.1 deprecates), Lombok, Testcontainers 2.0.5 for Postgres-backed integration tests, `spring-boot-starter-actuator` for `/actuator/health`.

## Global Constraints

- Single dashboard user, configured entirely via environment variables (`DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD_HASH` — a bcrypt hash, never a plaintext password) — no dashboard-user table, no signup flow, no multi-tenant auth.
- Every outbound call to python-findmy-service must carry `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>` (python-findmy-service rejects anything else with 401 — see `docs/superpowers/specs/2026-07-06-findmy-dashboard-design.md` and `docs/superpowers/plans/2026-07-06-python-findmy-service.md` Task 8).
- python-findmy-service's confirmed HTTP contract (do not deviate): `POST /accounts/login` `{apple_id, password}` → `{"status": "active"|"2fa_required"}` or 401; `POST /accounts/{apple_id}/2fa` `{code}` → `{"status": "active"}` or 400/401/429; `POST /accounts/{apple_id}/people` optional `{"password": ...}` body → JSON array of `{id, name, latitude, longitude, timestamp_ms}` or 401/409.
- Apple ID account passwords must be encrypted at rest (AES-GCM, key from `CREDENTIAL_ENCRYPTION_KEY` env var) — never stored in plaintext, never logged.
- `spring.jpa.hibernate.ddl-auto=validate` — Flyway owns the schema, Hibernate only validates against it, never auto-generates DDL.
- Reuse `spring-boot-starter-actuator` for the health endpoint rather than hand-writing one.
- One commit per completed task, pushed immediately (repo: `https://github.com/EduardoAlcaria/Kagein`).
- Directory: `spring-bff/` at the repo root, alongside the existing `python-findmy-service/`.

---

## Task 1: Maven scaffold, Postgres in docker-compose, verified DB connectivity

**Files:**
- Create: `spring-bff/pom.xml`
- Create: `spring-bff/src/main/java/com/kagein/springbff/SpringBffApplication.java`
- Create: `spring-bff/src/main/resources/application.yml`
- Create: `spring-bff/src/test/java/com/kagein/springbff/SpringBffApplicationTests.java`
- Create: `spring-bff/.gitignore`
- Modify: `docker-compose.yml` (repo root — add `postgres` service)

**Interfaces:**
- Produces: a bootable Spring Boot app with `/actuator/health`, a working `DataSource` against Postgres (verified via Testcontainers in the test, not just configured on faith) — every later task builds on this.

- [ ] **Step 1: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/SpringBffApplicationTests.java
package com.kagein.springbff;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@SpringBootTest
class SpringBffApplicationTests {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @org.springframework.beans.factory.annotation.Autowired
    private DataSource dataSource;

    @Test
    void contextLoadsAndConnectsToRealPostgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.isValid(2)).isTrue();
        }
    }
}
```

- [ ] **Step 2: Write the pom.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>4.1.0</version>
        <relativePath/>
    </parent>

    <groupId>com.kagein</groupId>
    <artifactId>spring-bff</artifactId>
    <version>0.1.0</version>
    <name>spring-bff</name>

    <properties>
        <java.version>21</java.version>
        <testcontainers.version>2.0.5</testcontainers.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <!-- Spring Boot 4.x split RestClientAutoConfiguration out of the core
                 autoconfigure jar into this starter — without it there's no
                 RestClient.Builder bean to @Autowired (needed by Task 4). -->
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-restclient</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-flyway</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <!-- Spring Boot 4.x split @DataJpaTest/@AutoConfigureTestDatabase out of
                 spring-boot-test-autoconfigure into this per-slice starter. -->
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <!-- Same Spring Boot 4.x split as above, but for @AutoConfigureMockMvc. -->
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-webmvc-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-testcontainers</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>testcontainers-junit-jupiter</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>testcontainers-postgresql</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.testcontainers</groupId>
                <artifactId>testcontainers-bom</artifactId>
                <version>${testcontainers.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <!-- Implicit annotation processor discovery from the classpath isn't
                         reliable on every JDK/Maven combination; declare Lombok explicitly. -->
                    <annotationProcessorPaths>
                        <path>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                            <version>${lombok.version}</version>
                        </path>
                    </annotationProcessorPaths>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 3: Write the application class and config**

```java
// spring-bff/src/main/java/com/kagein/springbff/SpringBffApplication.java
package com.kagein.springbff;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SpringBffApplication {
    public static void main(String[] args) {
        SpringApplication.run(SpringBffApplication.class, args);
    }
}
```

```yaml
# spring-bff/src/main/resources/application.yml
spring:
  application:
    name: spring-bff
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/findmy}
    username: ${SPRING_DATASOURCE_USERNAME:findmy}
    password: ${SPRING_DATASOURCE_PASSWORD:}

management:
  endpoints:
    web:
      exposure:
        include: health

server:
  port: 8080
```

```
# spring-bff/.gitignore
target/
*.class
```

**Note:** don't gitignore `.mvn/` — that directory holds the Maven
Wrapper files added in the next step, which must be committed so anyone
who clones this repo can build without a system-wide Maven install.

- [ ] **Step 4: Add the Maven Wrapper**

Maven is not assumed to be installed on the machine running this plan —
only a JDK. The Maven Wrapper (`./mvnw`) bootstraps its own Maven
distribution on first run, so every command in this plan uses `./mvnw`,
never a bare `mvn`.

```
# spring-bff/.mvn/wrapper/maven-wrapper.properties
wrapperVersion=3.3.4
distributionType=only-script
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.16/apache-maven-3.9.16-bin.zip
```

Fetch the two wrapper launcher scripts verbatim from the Apache Maven
Wrapper project (these are static, versioned files — do not hand-write
them):

```bash
mkdir -p spring-bff/.mvn/wrapper
curl -sL -o spring-bff/mvnw https://raw.githubusercontent.com/apache/maven-wrapper/master/maven-wrapper-distribution/src/resources/mvnw
curl -sL -o spring-bff/mvnw.cmd https://raw.githubusercontent.com/apache/maven-wrapper/master/maven-wrapper-distribution/src/resources/mvnw.cmd
sed -i 's/@@project\.version@@/3.3.4/g' spring-bff/mvnw spring-bff/mvnw.cmd
chmod +x spring-bff/mvnw
```

The two `curl`-fetched files contain an unsubstituted `@@project.version@@`
placeholder (a build-time token from the source template) — the `sed`
step above replaces it with the concrete wrapper version `3.3.4`,
matching `maven-wrapper.properties`. Skipping that `sed` step leaves a
broken script that references a nonexistent `maven-wrapper-@@project.version@@.jar`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test`
Expected: `BUILD SUCCESS`, `SpringBffApplicationTests` green — Testcontainers pulls
`postgres:17-alpine`, Spring Boot auto-wires the `DataSource` to it via
`@ServiceConnection`, and the connection validates. (First run downloads
the Postgres image and Maven dependencies — expect it to take longer than
subsequent runs.)

If you hit `ConnectionDetailsFactoryNotFoundException`, the `name =
"postgresql"` argument on `@ServiceConnection` above is required for
Spring Boot 4 — do not drop it even though older Spring Boot 3.x examples
you might find online omit it.

- [ ] **Step 6: Add Postgres to the root docker-compose.yml**

```yaml
# docker-compose.yml (repo root) — add this service and volume entry;
# leave the existing python-findmy-service service and findmy_sessions
# volume exactly as they are.
  postgres:
    image: postgres:17-alpine
    environment:
      - POSTGRES_DB=findmy
      - POSTGRES_USER=findmy
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in your shell or a .env file}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
```

Add `postgres_data:` alongside the existing `findmy_sessions:` entry under
the top-level `volumes:` key.

- [ ] **Step 7: Commit**

```bash
git add spring-bff/pom.xml spring-bff/src/main/java/com/kagein/springbff/SpringBffApplication.java spring-bff/src/main/resources/application.yml spring-bff/src/test/java/com/kagein/springbff/SpringBffApplicationTests.java spring-bff/.gitignore spring-bff/.mvn spring-bff/mvnw spring-bff/mvnw.cmd docker-compose.yml
git commit -m "Scaffold spring-bff with verified Postgres connectivity"
git push
```

---

## Task 2: Schema and JPA entities

**Files:**
- Create: `spring-bff/src/main/resources/db/migration/V1__init_schema.sql`
- Create: `spring-bff/src/main/java/com/kagein/springbff/domain/FmAccount.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/domain/AccountStatus.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/domain/Person.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/domain/PersonLocation.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/domain/AlertEvent.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/repository/FmAccountRepository.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/repository/PersonRepository.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/repository/PersonLocationRepository.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/repository/AlertEventRepository.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/repository/FmAccountRepositoryTest.java`

**Interfaces:**
- Consumes: the Postgres connectivity from Task 1 (Flyway runs on startup against the same datasource).
- Produces: `FmAccount` (`id`, `appleId`, `encryptedPassword`, `status: AccountStatus`, `createdAt`), `Person` (`id`, `fmAccountId`, `externalId`, `name`), `PersonLocation` (`id`, `personId`, `latitude`, `longitude`, `capturedAt`), `AlertEvent` (`id`, `personId`, `type`, `message`, `triggeredAt`), and their Spring Data repositories (`FmAccountRepository.findByAppleId(String)`, `PersonRepository.findByFmAccountIdAndExternalId(Long, String)`, `PersonLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(Long)`, `AlertEventRepository`) — Task 5 (accounts), Task 6 (polling), Task 7 (alerts), and Task 8 (read API) all depend on these exact names and signatures.

- [ ] **Step 1: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/repository/FmAccountRepositoryTest.java
package com.kagein.springbff.repository;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import org.junit.jupiter.api.Test;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class FmAccountRepositoryTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @org.springframework.beans.factory.annotation.Autowired
    private FmAccountRepository repository;

    @Test
    void savesAndFindsByAppleId() {
        FmAccount account = FmAccount.builder()
                .appleId("user@example.com")
                .encryptedPassword("encrypted-blob")
                .status(AccountStatus.PENDING_2FA)
                .createdAt(Instant.now())
                .build();
        repository.save(account);

        Optional<FmAccount> found = repository.findByAppleId("user@example.com");

        assertThat(found).isPresent();
        assertThat(found.get().getStatus()).isEqualTo(AccountStatus.PENDING_2FA);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=FmAccountRepositoryTest`
Expected: FAIL — compilation error, `com.kagein.springbff.domain.FmAccount`
and `FmAccountRepository` don't exist yet.

- [ ] **Step 3: Write the Flyway migration**

```sql
-- spring-bff/src/main/resources/db/migration/V1__init_schema.sql
CREATE TABLE fm_account (
    id BIGSERIAL PRIMARY KEY,
    apple_id VARCHAR(255) NOT NULL UNIQUE,
    encrypted_password TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE person (
    id BIGSERIAL PRIMARY KEY,
    fm_account_id BIGINT NOT NULL REFERENCES fm_account(id),
    external_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    UNIQUE (fm_account_id, external_id)
);

CREATE TABLE person_location (
    id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES person(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    captured_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_person_location_person_captured
    ON person_location (person_id, captured_at DESC);

CREATE TABLE alert_event (
    id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES person(id),
    type VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Write the entities**

```java
// spring-bff/src/main/java/com/kagein/springbff/domain/AccountStatus.java
package com.kagein.springbff.domain;

public enum AccountStatus {
    PENDING_2FA,
    ACTIVE,
    NEEDS_RELOGIN,
    ERROR
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/domain/FmAccount.java
package com.kagein.springbff.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "fm_account")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FmAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "apple_id", nullable = false, unique = true)
    private String appleId;

    @Column(name = "encrypted_password", nullable = false)
    private String encryptedPassword;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AccountStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/domain/Person.java
package com.kagein.springbff.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "person")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Person {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fm_account_id", nullable = false)
    private Long fmAccountId;

    @Column(name = "external_id", nullable = false)
    private String externalId;

    @Column(nullable = false)
    private String name;
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/domain/PersonLocation.java
package com.kagein.springbff.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "person_location")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "person_id", nullable = false)
    private Long personId;

    private Double latitude;

    private Double longitude;

    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt;
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/domain/AlertEvent.java
package com.kagein.springbff.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "alert_event")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "person_id", nullable = false)
    private Long personId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String message;

    @Column(name = "triggered_at", nullable = false)
    private Instant triggeredAt;
}
```

- [ ] **Step 5: Write the repositories**

```java
// spring-bff/src/main/java/com/kagein/springbff/repository/FmAccountRepository.java
package com.kagein.springbff.repository;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FmAccountRepository extends JpaRepository<FmAccount, Long> {
    Optional<FmAccount> findByAppleId(String appleId);
    List<FmAccount> findByStatus(AccountStatus status);
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/repository/PersonRepository.java
package com.kagein.springbff.repository;

import com.kagein.springbff.domain.Person;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PersonRepository extends JpaRepository<Person, Long> {
    Optional<Person> findByFmAccountIdAndExternalId(Long fmAccountId, String externalId);
    List<Person> findByFmAccountId(Long fmAccountId);
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/repository/PersonLocationRepository.java
package com.kagein.springbff.repository;

import com.kagein.springbff.domain.PersonLocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PersonLocationRepository extends JpaRepository<PersonLocation, Long> {
    List<PersonLocation> findTop50ByPersonIdOrderByCapturedAtDesc(Long personId);
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/repository/AlertEventRepository.java
package com.kagein.springbff.repository;

import com.kagein.springbff.domain.AlertEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertEventRepository extends JpaRepository<AlertEvent, Long> {
    List<AlertEvent> findTop100ByOrderByTriggeredAtDesc();
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=FmAccountRepositoryTest`
Expected: PASS

- [ ] **Step 7: Run the full test suite**

Run: `cd spring-bff && ./mvnw -q test`
Expected: `BUILD SUCCESS`, both test classes pass.

- [ ] **Step 8: Commit**

```bash
git add spring-bff/src/main/resources/db/migration/V1__init_schema.sql spring-bff/src/main/java/com/kagein/springbff/domain/ spring-bff/src/main/java/com/kagein/springbff/repository/ spring-bff/src/test/java/com/kagein/springbff/repository/
git commit -m "Add schema, entities, and repositories"
git push
```

---

## Task 3: Single-user dashboard auth

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/security/SecurityConfig.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/security/SecurityConfigTest.java`
- Modify: `spring-bff/src/main/resources/application.yml`

**Interfaces:**
- Produces: session-based HTTP Basic auth protecting every endpoint under `/api/**` (single user, credentials from `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD_HASH`), while `/actuator/health` stays open. Tasks 5, 7, 8's controllers all sit under `/api/**` and are protected by this config automatically — they don't need their own auth logic.

- [ ] **Step 1: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/security/SecurityConfigTest.java
package com.kagein.springbff.security;

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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        // bcrypt hash of "hunter2", generated for this test only
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm"
})
class SecurityConfigTest {

    // This test boots the full app context, which includes the JPA/Flyway
    // wiring from Task 2 — like every other @SpringBootTest in this
    // project, it needs a real Postgres via Testcontainers, not just a
    // MockMvc slice.
    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthEndpointIsPubliclyReachable() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void apiEndpointRejectsUnauthenticatedRequest() throws Exception {
        mockMvc.perform(get("/api/people")).andExpect(status().isUnauthorized());
    }

    @Test
    void apiEndpointRejectsWrongPassword() throws Exception {
        mockMvc.perform(get("/api/people").with(httpBasic("admin", "wrong")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void apiEndpointAcceptsCorrectCredentials() throws Exception {
        // /api/people doesn't exist until Task 8 — a 404 here still proves
        // authentication succeeded and authorization let the request through
        // to routing; only a 401/403 would mean auth is broken.
        mockMvc.perform(get("/api/people").with(httpBasic("admin", "hunter2")))
                .andExpect(status().isNotFound());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=SecurityConfigTest`
Expected: FAIL — with no `SecurityFilterChain` bean, Spring Security's
default auto-configuration generates a random password logged at startup
and protects everything, including `/actuator/health` (so
`healthEndpointIsPubliclyReachable` fails) and the explicit
`dashboard.username`/`dashboard.password-hash` properties aren't wired to
anything yet (so the credential-based tests fail as unauthorized too).

- [ ] **Step 3: Implement the security config**

```java
// spring-bff/src/main/java/com/kagein/springbff/security/SecurityConfig.java
package com.kagein.springbff.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    // ponytail: a bare bcrypt hash (no "{bcrypt}" prefix) doesn't route
    // through Spring Security's default DelegatingPasswordEncoder, which
    // throws "no PasswordEncoder mapped for the id \"null\"" at match
    // time — registering BCryptPasswordEncoder directly is the minimal
    // fix, not a speculative addition.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(
            @Value("${dashboard.username}") String username,
            @Value("${dashboard.password-hash}") String passwordHash) {
        return new InMemoryUserDetailsManager(
                User.withUsername(username)
                        .password(passwordHash)
                        .roles("DASHBOARD")
                        .build());
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health").permitAll()
                        .anyRequest().authenticated())
                .httpBasic(basic -> {})
                .csrf(csrf -> csrf.disable());
        return http.build();
    }
}
```

```yaml
# spring-bff/src/main/resources/application.yml — add under the existing keys
dashboard:
  username: ${DASHBOARD_USERNAME:}
  password-hash: ${DASHBOARD_PASSWORD_HASH:}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=SecurityConfigTest`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full suite**

Run: `cd spring-bff && ./mvnw -q test`
Expected: `BUILD SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/security/SecurityConfig.java spring-bff/src/test/java/com/kagein/springbff/security/SecurityConfigTest.java spring-bff/src/main/resources/application.yml
git commit -m "Add single-user dashboard authentication"
git push
```

**Note for whoever deploys this:** generate the real bcrypt hash before
running in docker-compose — e.g. via Python (already used elsewhere in
this repo): `pip install bcrypt` then
`python -c "import bcrypt; print(bcrypt.hashpw(b'yourpassword', bcrypt.gensalt()).decode())"`
— set the result as `DASHBOARD_PASSWORD_HASH`, never the plaintext.

---

## Task 4: python-findmy-service HTTP client

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/client/PythonFindMyClient.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/client/PersonDto.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/client/PythonFindMyException.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/client/PythonFindMyClientTest.java`
- Modify: `spring-bff/src/main/resources/application.yml`

**Interfaces:**
- Produces: `PythonFindMyClient.login(String appleId, String password): String` (returns `"active"` or `"2fa_required"`), `PythonFindMyClient.submit2fa(String appleId, String code): void` (throws on non-2xx), `PythonFindMyClient.getPeople(String appleId, String password): List<PersonDto>` (`password` nullable), `PersonDto(String id, String name, Double latitude, Double longitude, Long timestampMs)`, `PythonFindMyException` (carries the HTTP status code) — Task 5 (accounts) and Task 6 (polling) both call this client exclusively; neither talks to python-findmy-service directly.

- [ ] **Step 1: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/client/PythonFindMyClientTest.java
package com.kagein.springbff.client;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class PythonFindMyClientTest {

    private RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }

    @Test
    void loginReturnsActiveStatus() {
        RestClient.Builder builder = restClientBuilder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://python-findmy-service:8000/accounts/login"))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andExpect(header("X-Internal-Token", "test-token"))
                .andExpect(jsonPath("$.apple_id").value("user@example.com"))
                .andExpect(jsonPath("$.password").value("hunter2"))
                .andRespond(withSuccess("{\"status\":\"active\"}", MediaType.APPLICATION_JSON));

        PythonFindMyClient client = new PythonFindMyClient(
                builder, "http://python-findmy-service:8000", "test-token");

        String status = client.login("user@example.com", "hunter2");

        assertThat(status).isEqualTo("active");
        server.verify();
    }

    @Test
    void loginThrowsOnInvalidCredentials() {
        RestClient.Builder builder = restClientBuilder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://python-findmy-service:8000/accounts/login"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.UNAUTHORIZED));

        PythonFindMyClient client = new PythonFindMyClient(
                builder, "http://python-findmy-service:8000", "test-token");

        assertThatThrownBy(() -> client.login("user@example.com", "wrong"))
                .isInstanceOf(PythonFindMyException.class)
                .extracting("statusCode")
                .isEqualTo(401);
    }

    @Test
    void getPeopleParsesResponseIntoDtos() {
        RestClient.Builder builder = restClientBuilder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://python-findmy-service:8000/accounts/user%40example.com/people"))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andExpect(header("X-Internal-Token", "test-token"))
                .andRespond(withSuccess(
                        "[{\"id\":\"friend-1\",\"name\":\"Jane Doe\",\"latitude\":37.33,\"longitude\":-122.0,\"timestamp_ms\":1586034872142}]",
                        MediaType.APPLICATION_JSON));

        PythonFindMyClient client = new PythonFindMyClient(
                builder, "http://python-findmy-service:8000", "test-token");

        List<PersonDto> people = client.getPeople("user@example.com", null);

        assertThat(people).hasSize(1);
        assertThat(people.get(0).name()).isEqualTo("Jane Doe");
        server.verify();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PythonFindMyClientTest`
Expected: FAIL — `PythonFindMyClient`, `PersonDto`, `PythonFindMyException`
don't exist yet.

- [ ] **Step 3: Implement the client**

```java
// spring-bff/src/main/java/com/kagein/springbff/client/PersonDto.java
package com.kagein.springbff.client;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PersonDto(
        String id,
        String name,
        Double latitude,
        Double longitude,
        @JsonProperty("timestamp_ms") Long timestampMs) {
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/client/PythonFindMyException.java
package com.kagein.springbff.client;

public class PythonFindMyException extends RuntimeException {
    private final int statusCode;

    public PythonFindMyException(int statusCode, String message) {
        super(message);
        this.statusCode = statusCode;
    }

    public int getStatusCode() {
        return statusCode;
    }
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/client/PythonFindMyClient.java
package com.kagein.springbff.client;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

@Component
public class PythonFindMyClient {

    private final RestClient restClient;

    @Autowired
    public PythonFindMyClient(
            RestClient.Builder builder,
            @Value("${python-findmy-service.base-url}") String baseUrl,
            @Value("${python-findmy-service.internal-token}") String internalToken) {
        this.restClient = builder
                .baseUrl(baseUrl)
                .defaultHeader("X-Internal-Token", internalToken)
                .build();
    }

    public String login(String appleId, String password) {
        try {
            Map<String, Object> response = restClient.post()
                    .uri("/accounts/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("apple_id", appleId, "password", password))
                    .retrieve()
                    .body(Map.class);
            return (String) response.get("status");
        } catch (RestClientResponseException e) {
            throw new PythonFindMyException(e.getStatusCode().value(), e.getMessage());
        }
    }

    public void submit2fa(String appleId, String code) {
        try {
            // RestClient.uri(template, vars) already percent-encodes template
            // variables itself — pre-encoding appleId here would double-encode
            // the "@" in every real Apple ID (e.g. "%40" -> "%2540").
            restClient.post()
                    .uri("/accounts/{appleId}/2fa", appleId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("code", code))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            throw new PythonFindMyException(e.getStatusCode().value(), e.getMessage());
        }
    }

    public List<PersonDto> getPeople(String appleId, String password) {
        try {
            Map<String, Object> body = password == null ? Map.of() : Map.of("password", password);
            PersonDto[] people = restClient.post()
                    .uri("/accounts/{appleId}/people", appleId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(PersonDto[].class);
            return people == null ? List.of() : List.of(people);
        } catch (RestClientResponseException e) {
            throw new PythonFindMyException(e.getStatusCode().value(), e.getMessage());
        }
    }
}
```

```yaml
# spring-bff/src/main/resources/application.yml — add under the existing keys
python-findmy-service:
  base-url: ${PYTHON_FINDMY_SERVICE_URL:http://python-findmy-service:8000}
  internal-token: ${INTERNAL_SERVICE_TOKEN:}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PythonFindMyClientTest`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite**

Run: `cd spring-bff && ./mvnw -q test`
Expected: `BUILD SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/client/ spring-bff/src/test/java/com/kagein/springbff/client/ spring-bff/src/main/resources/application.yml
git commit -m "Add python-findmy-service HTTP client"
git push
```

---

## Task 5: Account registration and 2FA relay API

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/security/CredentialCipher.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/account/AccountController.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/account/RegisterAccountRequest.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/account/TwoFaRequest.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/security/CredentialCipherTest.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/account/AccountControllerTest.java`
- Modify: `spring-bff/src/main/resources/application.yml`

**Interfaces:**
- Consumes: `PythonFindMyClient` (Task 4), `FmAccountRepository` (Task 2), `SecurityConfig`'s auth (Task 3, applies automatically to `/api/**`).
- Produces: `CredentialCipher.encrypt(String): String` / `.decrypt(String): String` (AES-GCM, used again by Task 6), `POST /api/accounts` (`{appleId, password}` → registers, calls python-findmy-service login, persists `FmAccount` with status `ACTIVE` or `PENDING_2FA`), `POST /api/accounts/{appleId}/2fa` (`{code}` → relays to python-findmy-service, updates stored status to `ACTIVE`).

- [ ] **Step 1: Write the failing tests for CredentialCipher**

```java
// spring-bff/src/test/java/com/kagein/springbff/security/CredentialCipherTest.java
package com.kagein.springbff.security;

import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.security.SecureRandom;

import static org.assertj.core.api.Assertions.assertThat;

class CredentialCipherTest {

    private static String randomBase64Key() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return Base64.getEncoder().encodeToString(key);
    }

    @Test
    void encryptsAndDecryptsRoundTrip() {
        CredentialCipher cipher = new CredentialCipher(randomBase64Key());

        String encrypted = cipher.encrypt("hunter2");

        assertThat(encrypted).isNotEqualTo("hunter2");
        assertThat(cipher.decrypt(encrypted)).isEqualTo("hunter2");
    }

    @Test
    void sameInputProducesDifferentCiphertextEachTime() {
        CredentialCipher cipher = new CredentialCipher(randomBase64Key());

        String first = cipher.encrypt("hunter2");
        String second = cipher.encrypt("hunter2");

        assertThat(first).isNotEqualTo(second);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=CredentialCipherTest`
Expected: FAIL — `CredentialCipher` doesn't exist yet.

- [ ] **Step 3: Implement CredentialCipher**

```java
// spring-bff/src/main/java/com/kagein/springbff/security/CredentialCipher.java
package com.kagein.springbff.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Component
public class CredentialCipher {

    private static final int IV_LENGTH_BYTES = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final SecretKeySpec key;

    public CredentialCipher(@Value("${credential.encryption-key}") String base64Key) {
        this.key = new SecretKeySpec(Base64.getDecoder().decode(base64Key), "AES");
    }

    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            ByteBuffer buffer = ByteBuffer.allocate(iv.length + ciphertext.length);
            buffer.put(iv).put(ciphertext);
            return Base64.getEncoder().encodeToString(buffer.array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("failed to encrypt credential", e);
        }
    }

    public String decrypt(String encoded) {
        try {
            byte[] combined = Base64.getDecoder().decode(encoded);
            byte[] iv = Arrays.copyOfRange(combined, 0, IV_LENGTH_BYTES);
            byte[] ciphertext = Arrays.copyOfRange(combined, IV_LENGTH_BYTES, combined.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("failed to decrypt credential", e);
        }
    }
}
```

```yaml
# spring-bff/src/main/resources/application.yml — add under the existing keys
credential:
  encryption-key: ${CREDENTIAL_ENCRYPTION_KEY:}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=CredentialCipherTest`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing tests for AccountController**

```java
// spring-bff/src/test/java/com/kagein/springbff/account/AccountControllerTest.java
package com.kagein.springbff.account;

import com.kagein.springbff.client.PythonFindMyClient;
import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.security.CredentialCipher;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm",
        "credential.encryption-key=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
})
class AccountControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PythonFindMyClient pythonFindMyClient;

    @MockitoBean
    private FmAccountRepository fmAccountRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void registerAccountPersistsActiveStatus() throws Exception {
        when(pythonFindMyClient.login("user@example.com", "hunter2")).thenReturn("active");
        when(fmAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/accounts")
                        .with(httpBasic("admin", "hunter2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterAccountRequest("user@example.com", "hunter2"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("active"));

        verify(fmAccountRepository).save(argThat(account ->
                account.getAppleId().equals("user@example.com")
                        && account.getStatus() == AccountStatus.ACTIVE
                        && !account.getEncryptedPassword().equals("hunter2")));
    }

    @Test
    void registerAccountPersistsPending2faStatus() throws Exception {
        when(pythonFindMyClient.login(anyString(), anyString())).thenReturn("2fa_required");
        when(fmAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/accounts")
                        .with(httpBasic("admin", "hunter2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterAccountRequest("user@example.com", "hunter2"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("2fa_required"));
    }

    @Test
    void submit2faUpdatesStoredAccountToActive() throws Exception {
        FmAccount pending = FmAccount.builder()
                .id(1L)
                .appleId("user@example.com")
                .encryptedPassword("irrelevant")
                .status(AccountStatus.PENDING_2FA)
                .build();
        when(fmAccountRepository.findByAppleId("user@example.com")).thenReturn(Optional.of(pending));
        when(fmAccountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/accounts/user@example.com/2fa")
                        .with(httpBasic("admin", "hunter2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new TwoFaRequest("123456"))))
                .andExpect(status().isOk());

        verify(pythonFindMyClient).submit2fa("user@example.com", "123456");
        verify(fmAccountRepository).save(argThat(account -> account.getStatus() == AccountStatus.ACTIVE));
    }
}
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=AccountControllerTest`
Expected: FAIL — `AccountController`, `RegisterAccountRequest`,
`TwoFaRequest` don't exist yet.

- [ ] **Step 7: Implement**

```java
// spring-bff/src/main/java/com/kagein/springbff/account/RegisterAccountRequest.java
package com.kagein.springbff.account;

public record RegisterAccountRequest(String appleId, String password) {
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/account/TwoFaRequest.java
package com.kagein.springbff.account;

public record TwoFaRequest(String code) {
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/account/AccountController.java
package com.kagein.springbff.account;

import com.kagein.springbff.client.PythonFindMyClient;
import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.security.CredentialCipher;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final PythonFindMyClient pythonFindMyClient;
    private final FmAccountRepository fmAccountRepository;
    private final CredentialCipher credentialCipher;

    public AccountController(
            PythonFindMyClient pythonFindMyClient,
            FmAccountRepository fmAccountRepository,
            CredentialCipher credentialCipher) {
        this.pythonFindMyClient = pythonFindMyClient;
        this.fmAccountRepository = fmAccountRepository;
        this.credentialCipher = credentialCipher;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> register(@RequestBody RegisterAccountRequest request) {
        String status = pythonFindMyClient.login(request.appleId(), request.password());
        FmAccount account = FmAccount.builder()
                .appleId(request.appleId())
                .encryptedPassword(credentialCipher.encrypt(request.password()))
                .status("active".equals(status) ? AccountStatus.ACTIVE : AccountStatus.PENDING_2FA)
                .createdAt(Instant.now())
                .build();
        fmAccountRepository.save(account);
        return ResponseEntity.ok(Map.of("status", status));
    }

    @PostMapping("/{appleId}/2fa")
    public ResponseEntity<Map<String, String>> submit2fa(
            @PathVariable String appleId, @RequestBody TwoFaRequest request) {
        FmAccount account = fmAccountRepository.findByAppleId(appleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        pythonFindMyClient.submit2fa(appleId, request.code());
        account.setStatus(AccountStatus.ACTIVE);
        fmAccountRepository.save(account);
        return ResponseEntity.ok(Map.of("status", "active"));
    }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=AccountControllerTest`
Expected: PASS (3 tests)

- [ ] **Step 9: Run the full suite**

Run: `cd spring-bff && ./mvnw -q test`
Expected: `BUILD SUCCESS`

- [ ] **Step 10: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/security/CredentialCipher.java spring-bff/src/main/java/com/kagein/springbff/account/ spring-bff/src/test/java/com/kagein/springbff/security/CredentialCipherTest.java spring-bff/src/test/java/com/kagein/springbff/account/ spring-bff/src/main/resources/application.yml
git commit -m "Add account registration and 2FA relay API"
git push
```

---

## Task 6: Polling scheduler and location persistence

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/poll/PollingService.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/poll/PollingServiceTest.java`
- Modify: `spring-bff/src/main/resources/application.yml`

**Interfaces:**
- Consumes: `PythonFindMyClient.getPeople` (Task 4), `CredentialCipher.decrypt` (Task 5), `FmAccountRepository`/`PersonRepository`/`PersonLocationRepository` (Task 2).
- Produces: `PollingService.pollAllActiveAccounts(): void` (`@Scheduled`, calls `pollAccount` per `ACTIVE` account), `PollingService.pollAccount(FmAccount): void` (upserts `Person` by `(fmAccountId, externalId)`, inserts a new `PersonLocation` row per poll) — Task 7's alert engine reads the `PersonLocation` rows this produces.

This task tests the polling **logic** directly (calling `pollAccount`/`pollAllActiveAccounts` as plain methods with mocked dependencies) rather than waiting for `@Scheduled`'s timer to fire — that would make tests slow and flaky for no benefit, since Spring's scheduling wiring is a well-tested framework feature, not something this project needs to re-verify.

- [ ] **Step 1: Write the failing tests**

```java
// spring-bff/src/test/java/com/kagein/springbff/poll/PollingServiceTest.java
package com.kagein.springbff.poll;

import com.kagein.springbff.client.PersonDto;
import com.kagein.springbff.client.PythonFindMyClient;
import com.kagein.springbff.domain.*;
import com.kagein.springbff.repository.*;
import com.kagein.springbff.security.CredentialCipher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PollingServiceTest {

    @Mock private PythonFindMyClient pythonFindMyClient;
    @Mock private CredentialCipher credentialCipher;
    @Mock private FmAccountRepository fmAccountRepository;
    @Mock private PersonRepository personRepository;
    @Mock private PersonLocationRepository personLocationRepository;

    @InjectMocks
    private PollingService pollingService;

    @Test
    void pollAccountCreatesNewPersonAndLocationOnFirstSighting() {
        FmAccount account = FmAccount.builder()
                .id(1L).appleId("user@example.com")
                .encryptedPassword("enc").status(AccountStatus.ACTIVE).build();
        when(credentialCipher.decrypt("enc")).thenReturn("hunter2");
        when(pythonFindMyClient.getPeople("user@example.com", "hunter2"))
                .thenReturn(List.of(new PersonDto("friend-1", "Jane Doe", 37.33, -122.0, 1586034872142L)));
        when(personRepository.findByFmAccountIdAndExternalId(1L, "friend-1")).thenReturn(Optional.empty());
        when(personRepository.save(any())).thenAnswer(inv -> {
            Person p = inv.getArgument(0);
            p.setId(10L);
            return p;
        });

        pollingService.pollAccount(account);

        verify(personRepository).save(argThat(p ->
                p.getFmAccountId().equals(1L) && p.getExternalId().equals("friend-1") && p.getName().equals("Jane Doe")));
        verify(personLocationRepository).save(argThat(loc ->
                loc.getPersonId().equals(10L) && loc.getLatitude().equals(37.33)));
    }

    @Test
    void pollAccountReusesExistingPersonOnSubsequentSighting() {
        FmAccount account = FmAccount.builder()
                .id(1L).appleId("user@example.com")
                .encryptedPassword("enc").status(AccountStatus.ACTIVE).build();
        Person existing = Person.builder().id(10L).fmAccountId(1L).externalId("friend-1").name("Jane Doe").build();
        when(credentialCipher.decrypt("enc")).thenReturn("hunter2");
        when(pythonFindMyClient.getPeople("user@example.com", "hunter2"))
                .thenReturn(List.of(new PersonDto("friend-1", "Jane Doe", 37.34, -122.1, 1586034900000L)));
        when(personRepository.findByFmAccountIdAndExternalId(1L, "friend-1")).thenReturn(Optional.of(existing));

        pollingService.pollAccount(account);

        verify(personRepository, never()).save(any());
        verify(personLocationRepository).save(argThat(loc -> loc.getPersonId().equals(10L)));
    }

    @Test
    void pollAllActiveAccountsOnlyPollsActiveOnes() {
        FmAccount active = FmAccount.builder()
                .id(1L).appleId("a@example.com").encryptedPassword("enc")
                .status(AccountStatus.ACTIVE).build();
        when(fmAccountRepository.findByStatus(AccountStatus.ACTIVE)).thenReturn(List.of(active));
        when(credentialCipher.decrypt("enc")).thenReturn("hunter2");
        when(pythonFindMyClient.getPeople(any(), any())).thenReturn(List.of());

        pollingService.pollAllActiveAccounts();

        verify(pythonFindMyClient).getPeople("a@example.com", "hunter2");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PollingServiceTest`
Expected: FAIL — `PollingService` doesn't exist yet.

- [ ] **Step 3: Implement**

```java
// spring-bff/src/main/java/com/kagein/springbff/poll/PollingService.java
package com.kagein.springbff.poll;

import com.kagein.springbff.client.PersonDto;
import com.kagein.springbff.client.PythonFindMyClient;
import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import com.kagein.springbff.repository.PersonRepository;
import com.kagein.springbff.security.CredentialCipher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class PollingService {

    private final PythonFindMyClient pythonFindMyClient;
    private final CredentialCipher credentialCipher;
    private final FmAccountRepository fmAccountRepository;
    private final PersonRepository personRepository;
    private final PersonLocationRepository personLocationRepository;

    public PollingService(
            PythonFindMyClient pythonFindMyClient,
            CredentialCipher credentialCipher,
            FmAccountRepository fmAccountRepository,
            PersonRepository personRepository,
            PersonLocationRepository personLocationRepository) {
        this.pythonFindMyClient = pythonFindMyClient;
        this.credentialCipher = credentialCipher;
        this.fmAccountRepository = fmAccountRepository;
        this.personRepository = personRepository;
        this.personLocationRepository = personLocationRepository;
    }

    @Scheduled(fixedDelayString = "${polling.interval-ms:60000}")
    public void pollAllActiveAccounts() {
        for (FmAccount account : fmAccountRepository.findByStatus(AccountStatus.ACTIVE)) {
            pollAccount(account);
        }
    }

    public void pollAccount(FmAccount account) {
        String password = credentialCipher.decrypt(account.getEncryptedPassword());
        for (PersonDto dto : pythonFindMyClient.getPeople(account.getAppleId(), password)) {
            Person person = personRepository.findByFmAccountIdAndExternalId(account.getId(), dto.id())
                    .orElseGet(() -> personRepository.save(Person.builder()
                            .fmAccountId(account.getId())
                            .externalId(dto.id())
                            .name(dto.name())
                            .build()));
            if (dto.latitude() != null && dto.longitude() != null) {
                personLocationRepository.save(PersonLocation.builder()
                        .personId(person.getId())
                        .latitude(dto.latitude())
                        .longitude(dto.longitude())
                        .capturedAt(dto.timestampMs() != null
                                ? Instant.ofEpochMilli(dto.timestampMs())
                                : Instant.now())
                        .build());
            }
        }
    }
}
```

```yaml
# spring-bff/src/main/resources/application.yml — add under the existing keys
polling:
  interval-ms: ${POLLING_INTERVAL_MS:60000}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PollingServiceTest`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite**

Run: `cd spring-bff && ./mvnw -q test`
Expected: `BUILD SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/poll/ spring-bff/src/test/java/com/kagein/springbff/poll/ spring-bff/src/main/resources/application.yml
git commit -m "Add polling scheduler and location persistence"
git push
```

---

## Task 7: Stale-update alert detection

The spec's alert list (geofence enter/exit, stale update) is broader than
this task builds. **Scope for v1: stale-update detection only** — the
simplest rule that's actually useful before there's any location history
to define geofences against. A generic, configurable `AlertRule` table is
deliberately deferred: with exactly one rule type, a table modeling
arbitrary rules is speculative machinery, not something this task needs.
Geofencing needs its own design pass (what counts as "an area"? per
person or global?) — better as a follow-up task once there's real usage
to inform it, not guessed at here.

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/alert/StaleUpdateAlertService.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/alert/AlertController.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/alert/AlertEventDto.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/alert/StaleUpdateAlertServiceTest.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/alert/AlertControllerTest.java`
- Modify: `spring-bff/src/main/java/com/kagein/springbff/poll/PollingService.java` (call the alert check after each poll)
- Modify: `spring-bff/src/test/java/com/kagein/springbff/poll/PollingServiceTest.java` (account for the new collaborator)
- Modify: `spring-bff/src/main/resources/application.yml`

**Interfaces:**
- Consumes: `PersonRepository`/`PersonLocationRepository`/`AlertEventRepository` (Task 2), called from `PollingService.pollAccount` (Task 6).
- Produces: `StaleUpdateAlertService.checkPerson(Person): void` (fires an `AlertEvent` of type `"STALE_UPDATE"` if the person's latest `PersonLocation.capturedAt` is older than the configured threshold, and only once per staleness episode — not a fresh alert every single poll), `GET /api/alerts` returning the most recent `AlertEventDto(Long id, Long personId, String type, String message, Instant triggeredAt)` list.

- [ ] **Step 1: Write the failing tests for StaleUpdateAlertService**

```java
// spring-bff/src/test/java/com/kagein/springbff/alert/StaleUpdateAlertServiceTest.java
package com.kagein.springbff.alert;

import com.kagein.springbff.domain.AlertEvent;
import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.AlertEventRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaleUpdateAlertServiceTest {

    @Mock private PersonLocationRepository personLocationRepository;
    @Mock private AlertEventRepository alertEventRepository;

    @InjectMocks
    private StaleUpdateAlertService alertService;

    private Person person(long id) {
        return Person.builder().id(id).fmAccountId(1L).externalId("friend-1").name("Jane Doe").build();
    }

    @Test
    void firesAlertWhenLatestLocationOlderThanThreshold() {
        ReflectionTestUtils.setField(alertService, "staleThresholdHours", 6L);
        PersonLocation stale = PersonLocation.builder()
                .id(1L).personId(10L)
                .capturedAt(Instant.now().minus(7, ChronoUnit.HOURS)).build();
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(stale));
        when(alertEventRepository.findTop100ByOrderByTriggeredAtDesc()).thenReturn(List.of());

        alertService.checkPerson(person(10L));

        verify(alertEventRepository).save(argThat(event ->
                event.getPersonId().equals(10L) && event.getType().equals("STALE_UPDATE")));
    }

    @Test
    void doesNotFireWhenLatestLocationIsRecent() {
        ReflectionTestUtils.setField(alertService, "staleThresholdHours", 6L);
        PersonLocation recent = PersonLocation.builder()
                .id(1L).personId(10L)
                .capturedAt(Instant.now().minus(1, ChronoUnit.HOURS)).build();
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(recent));

        alertService.checkPerson(person(10L));

        verify(alertEventRepository, never()).save(any());
    }

    @Test
    void doesNotFireASecondTimeForTheSameStalenessEpisode() {
        ReflectionTestUtils.setField(alertService, "staleThresholdHours", 6L);
        PersonLocation stale = PersonLocation.builder()
                .id(1L).personId(10L)
                .capturedAt(Instant.now().minus(7, ChronoUnit.HOURS)).build();
        AlertEvent alreadyFired = AlertEvent.builder()
                .id(1L).personId(10L).type("STALE_UPDATE").message("stale")
                .triggeredAt(Instant.now().minus(2, ChronoUnit.HOURS)).build();
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(stale));
        when(alertEventRepository.findTop100ByOrderByTriggeredAtDesc()).thenReturn(List.of(alreadyFired));

        alertService.checkPerson(person(10L));

        verify(alertEventRepository, never()).save(any());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=StaleUpdateAlertServiceTest`
Expected: FAIL — `StaleUpdateAlertService` doesn't exist yet.

- [ ] **Step 3: Implement StaleUpdateAlertService**

```java
// spring-bff/src/main/java/com/kagein/springbff/alert/StaleUpdateAlertService.java
package com.kagein.springbff.alert;

import com.kagein.springbff.domain.AlertEvent;
import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.AlertEventRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class StaleUpdateAlertService {

    private final PersonLocationRepository personLocationRepository;
    private final AlertEventRepository alertEventRepository;

    @Value("${alert.stale-threshold-hours:6}")
    private long staleThresholdHours;

    public StaleUpdateAlertService(
            PersonLocationRepository personLocationRepository,
            AlertEventRepository alertEventRepository) {
        this.personLocationRepository = personLocationRepository;
        this.alertEventRepository = alertEventRepository;
    }

    public void checkPerson(Person person) {
        List<PersonLocation> locations =
                personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(person.getId());
        if (locations.isEmpty()) {
            return;
        }
        PersonLocation latest = locations.get(0);
        boolean isStale = latest.getCapturedAt().isBefore(Instant.now().minus(staleThresholdHours, ChronoUnit.HOURS));
        if (!isStale) {
            return;
        }
        boolean alreadyFiredForThisEpisode = alertEventRepository.findTop100ByOrderByTriggeredAtDesc().stream()
                .anyMatch(event -> event.getPersonId().equals(person.getId())
                        && event.getType().equals("STALE_UPDATE")
                        && event.getTriggeredAt().isAfter(latest.getCapturedAt()));
        if (alreadyFiredForThisEpisode) {
            return;
        }
        alertEventRepository.save(AlertEvent.builder()
                .personId(person.getId())
                .type("STALE_UPDATE")
                .message(person.getName() + " hasn't shared an updated location in over "
                        + staleThresholdHours + " hours")
                .triggeredAt(Instant.now())
                .build());
    }
}
```

```yaml
# spring-bff/src/main/resources/application.yml — add under the existing keys
alert:
  stale-threshold-hours: ${ALERT_STALE_THRESHOLD_HOURS:6}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=StaleUpdateAlertServiceTest`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire the alert check into PollingService**

Update `spring-bff/src/main/java/com/kagein/springbff/poll/PollingService.java`:
add a `StaleUpdateAlertService` constructor parameter/field, and call
`staleUpdateAlertService.checkPerson(person);` at the end of the loop body
in `pollAccount`, right after the location-save block (whether or not a
new location was actually saved this cycle — staleness must still be
re-evaluated even when `dto.latitude()`/`dto.longitude()` were null).

```java
// spring-bff/src/main/java/com/kagein/springbff/poll/PollingService.java — full updated file
package com.kagein.springbff.poll;

import com.kagein.springbff.alert.StaleUpdateAlertService;
import com.kagein.springbff.client.PersonDto;
import com.kagein.springbff.client.PythonFindMyClient;
import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import com.kagein.springbff.repository.PersonRepository;
import com.kagein.springbff.security.CredentialCipher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class PollingService {

    private final PythonFindMyClient pythonFindMyClient;
    private final CredentialCipher credentialCipher;
    private final FmAccountRepository fmAccountRepository;
    private final PersonRepository personRepository;
    private final PersonLocationRepository personLocationRepository;
    private final StaleUpdateAlertService staleUpdateAlertService;

    public PollingService(
            PythonFindMyClient pythonFindMyClient,
            CredentialCipher credentialCipher,
            FmAccountRepository fmAccountRepository,
            PersonRepository personRepository,
            PersonLocationRepository personLocationRepository,
            StaleUpdateAlertService staleUpdateAlertService) {
        this.pythonFindMyClient = pythonFindMyClient;
        this.credentialCipher = credentialCipher;
        this.fmAccountRepository = fmAccountRepository;
        this.personRepository = personRepository;
        this.personLocationRepository = personLocationRepository;
        this.staleUpdateAlertService = staleUpdateAlertService;
    }

    @Scheduled(fixedDelayString = "${polling.interval-ms:60000}")
    public void pollAllActiveAccounts() {
        for (FmAccount account : fmAccountRepository.findByStatus(AccountStatus.ACTIVE)) {
            pollAccount(account);
        }
    }

    public void pollAccount(FmAccount account) {
        String password = credentialCipher.decrypt(account.getEncryptedPassword());
        for (PersonDto dto : pythonFindMyClient.getPeople(account.getAppleId(), password)) {
            Person person = personRepository.findByFmAccountIdAndExternalId(account.getId(), dto.id())
                    .orElseGet(() -> personRepository.save(Person.builder()
                            .fmAccountId(account.getId())
                            .externalId(dto.id())
                            .name(dto.name())
                            .build()));
            if (dto.latitude() != null && dto.longitude() != null) {
                personLocationRepository.save(PersonLocation.builder()
                        .personId(person.getId())
                        .latitude(dto.latitude())
                        .longitude(dto.longitude())
                        .capturedAt(dto.timestampMs() != null
                                ? Instant.ofEpochMilli(dto.timestampMs())
                                : Instant.now())
                        .build());
            }
            staleUpdateAlertService.checkPerson(person);
        }
    }
}
```

Update `spring-bff/src/test/java/com/kagein/springbff/poll/PollingServiceTest.java`:
add `@Mock private StaleUpdateAlertService staleUpdateAlertService;` as a
new field (Mockito's `@InjectMocks` picks it up automatically via
constructor injection — no other change needed in that test file).

- [ ] **Step 6: Run the polling tests to confirm nothing broke**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PollingServiceTest`
Expected: PASS (3 tests, unchanged assertions — the new collaborator is
just an unverified mock in these three tests since they don't assert
alert behavior)

- [ ] **Step 7: Write the failing tests for AlertController**

```java
// spring-bff/src/test/java/com/kagein/springbff/alert/AlertControllerTest.java
package com.kagein.springbff.alert;

import com.kagein.springbff.domain.AlertEvent;
import com.kagein.springbff.repository.AlertEventRepository;
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
class AlertControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AlertEventRepository alertEventRepository;

    @Test
    void listAlertsReturnsRecentEvents() throws Exception {
        when(alertEventRepository.findTop100ByOrderByTriggeredAtDesc()).thenReturn(List.of(
                AlertEvent.builder().id(1L).personId(10L).type("STALE_UPDATE")
                        .message("Jane Doe hasn't shared an updated location in over 6 hours")
                        .triggeredAt(Instant.now()).build()));

        mockMvc.perform(get("/api/alerts").with(httpBasic("admin", "hunter2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("STALE_UPDATE"))
                .andExpect(jsonPath("$[0].personId").value(10));
    }
}
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=AlertControllerTest`
Expected: FAIL — `AlertController`, `AlertEventDto` don't exist yet.

- [ ] **Step 9: Implement**

```java
// spring-bff/src/main/java/com/kagein/springbff/alert/AlertEventDto.java
package com.kagein.springbff.alert;

import java.time.Instant;

public record AlertEventDto(Long id, Long personId, String type, String message, Instant triggeredAt) {
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/alert/AlertController.java
package com.kagein.springbff.alert;

import com.kagein.springbff.repository.AlertEventRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertEventRepository alertEventRepository;

    public AlertController(AlertEventRepository alertEventRepository) {
        this.alertEventRepository = alertEventRepository;
    }

    @GetMapping
    public List<AlertEventDto> listAlerts() {
        return alertEventRepository.findTop100ByOrderByTriggeredAtDesc().stream()
                .map(event -> new AlertEventDto(
                        event.getId(), event.getPersonId(), event.getType(),
                        event.getMessage(), event.getTriggeredAt()))
                .toList();
    }
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=AlertControllerTest`
Expected: PASS

- [ ] **Step 11: Run the full suite**

Run: `cd spring-bff && ./mvnw -q test`
Expected: `BUILD SUCCESS`

- [ ] **Step 12: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/alert/ spring-bff/src/main/java/com/kagein/springbff/poll/PollingService.java spring-bff/src/test/java/com/kagein/springbff/alert/ spring-bff/src/test/java/com/kagein/springbff/poll/PollingServiceTest.java spring-bff/src/main/resources/application.yml
git commit -m "Add stale-update alert detection"
git push
```

---

## Task 8: People/locations read API, Dockerize, wire into docker-compose

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/people/PeopleController.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/people/PersonSummaryDto.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/people/PersonLocationDto.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/people/PeopleControllerTest.java`
- Create: `spring-bff/Dockerfile`
- Modify: `docker-compose.yml` (repo root — add `spring-bff` service)

**Interfaces:**
- Consumes: `PersonRepository`/`PersonLocationRepository` (Task 2).
- Produces: `GET /api/people` → `List<PersonSummaryDto(Long id, String name, PersonLocationDto latest)>` (one entry per known person, most recent location only), `GET /api/people/{id}/locations` → `List<PersonLocationDto(Double latitude, Double longitude, Instant capturedAt)>` (history, most recent first) — this is the exact contract the (not-yet-built) React frontend consumes.

- [ ] **Step 1: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/people/PeopleControllerTest.java
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PeopleControllerTest`
Expected: FAIL — `PeopleController`, `PersonSummaryDto`, `PersonLocationDto`
don't exist yet.

- [ ] **Step 3: Implement**

```java
// spring-bff/src/main/java/com/kagein/springbff/people/PersonLocationDto.java
package com.kagein.springbff.people;

import java.time.Instant;

public record PersonLocationDto(Double latitude, Double longitude, Instant capturedAt) {
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/people/PersonSummaryDto.java
package com.kagein.springbff.people;

public record PersonSummaryDto(Long id, String name, PersonLocationDto latest) {
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/people/PeopleController.java
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PeopleControllerTest`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full suite**

Run: `cd spring-bff && ./mvnw -q test`
Expected: `BUILD SUCCESS` — every task's tests, including Task 1's
Testcontainers-backed ones.

- [ ] **Step 6: Write the Dockerfile**

```dockerfile
# spring-bff/Dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/target/spring-bff-0.1.0.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

- [ ] **Step 7: Add spring-bff to the root docker-compose.yml**

```yaml
# docker-compose.yml (repo root) — add this service; leave every existing
# service and volume exactly as they are.
  spring-bff:
    build: ./spring-bff
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/findmy
      - SPRING_DATASOURCE_USERNAME=findmy
      - SPRING_DATASOURCE_PASSWORD=${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in your shell or a .env file}
      - PYTHON_FINDMY_SERVICE_URL=http://python-findmy-service:8000
      - INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN:?set INTERNAL_SERVICE_TOKEN in your shell or a .env file}
      - DASHBOARD_USERNAME=${DASHBOARD_USERNAME:?set DASHBOARD_USERNAME in your shell or a .env file}
      - DASHBOARD_PASSWORD_HASH=${DASHBOARD_PASSWORD_HASH:?set DASHBOARD_PASSWORD_HASH in your shell or a .env file}
      - CREDENTIAL_ENCRYPTION_KEY=${CREDENTIAL_ENCRYPTION_KEY:?set CREDENTIAL_ENCRYPTION_KEY in your shell or a .env file}
    depends_on:
      - postgres
      - python-findmy-service
```

`CREDENTIAL_ENCRYPTION_KEY` must be a base64-encoded 256-bit key — generate
one with: `python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"`

- [ ] **Step 8: Build and smoke-test**

```bash
export POSTGRES_PASSWORD=local-dev-password
export INTERNAL_SERVICE_TOKEN=local-dev-token
export DASHBOARD_USERNAME=admin
export DASHBOARD_PASSWORD_HASH='<bcrypt hash from Task 3's note>'
export CREDENTIAL_ENCRYPTION_KEY='<base64 key from Step 7>'
docker compose build spring-bff
docker compose up -d postgres python-findmy-service spring-bff
curl -s http://localhost:8080/actuator/health
```
Expected: `{"status":"UP"}` — Flyway will have run all migrations against
the real `postgres` container on startup; check `docker compose logs
spring-bff` if it doesn't come up clean.

```bash
curl -s -u admin:yourpassword http://localhost:8080/api/people
```
Expected: `[]` (empty array — no accounts registered yet in this fresh
environment).

```bash
docker compose down
```

- [ ] **Step 9: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/people/ spring-bff/src/test/java/com/kagein/springbff/people/ spring-bff/Dockerfile docker-compose.yml
git commit -m "Add people/locations read API, dockerize spring-bff"
git push
```

---

## Done criteria

`spring-bff` is complete when: `./mvnw test` passes with every test from
Tasks 1-8 (including the Testcontainers-backed ones, which require Docker
to be running locally), the container builds and serves
`/actuator/health` and `/api/people` against a real Postgres instance in
docker-compose, and an account registered through `POST /api/accounts`
can be polled by the scheduler and read back through `GET /api/people`
end to end against a real python-findmy-service + real Apple ID (this
needs Task 1 of the python-findmy-service plan — the live spike — to
already be confirmed, since spring-bff's account flow is only as correct
as the `fmf` response shape python-findmy-service assumes). At that point
the next plan (react-frontend) can be written against spring-bff's
confirmed `/api/accounts`, `/api/alerts`, and `/api/people` contract.
