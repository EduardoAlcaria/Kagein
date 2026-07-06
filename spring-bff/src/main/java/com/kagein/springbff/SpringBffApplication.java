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
