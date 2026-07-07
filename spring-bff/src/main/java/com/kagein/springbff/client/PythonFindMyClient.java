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
