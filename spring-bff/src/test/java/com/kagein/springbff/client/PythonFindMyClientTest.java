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
