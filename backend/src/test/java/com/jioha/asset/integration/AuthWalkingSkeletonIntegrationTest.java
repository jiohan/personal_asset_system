package com.jioha.asset.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthWalkingSkeletonIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @Test
  void me_requires_authentication() throws Exception {
    mockMvc.perform(get("/api/v1/auth/me"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
  }

  @Test
  void login_then_me_returns_authenticated_user() throws Exception {
    MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "demo@local.dev",
                  "password": "demo12345"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.email").value("demo@local.dev"))
        .andReturn();

    jakarta.servlet.http.Cookie sessionCookie = loginResult.getResponse().getCookie("SESSION");
    assertThat(sessionCookie).isNotNull();

    mockMvc.perform(get("/api/v1/auth/me").cookie(sessionCookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.email").value("demo@local.dev"));
  }
}
