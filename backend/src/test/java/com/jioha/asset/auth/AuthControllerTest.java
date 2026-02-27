package com.jioha.asset.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.flyway.enabled=false",
    "spring.datasource.url=jdbc:h2:mem:asset_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driverClassName=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.session.store-type=jdbc",
    "spring.session.jdbc.initialize-schema=always"
})
@AutoConfigureMockMvc
class AuthControllerTest {

  @Autowired
  MockMvc mvc;

  @Autowired
  ObjectMapper objectMapper;

  @Test
  void me_unauthorized_returnsJsonError_and_setsXsrfCookie() throws Exception {
    mvc.perform(get("/api/v1/auth/me"))
        .andExpect(status().isUnauthorized())
        .andExpect(cookie().exists("XSRF-TOKEN"))
        .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
}

  @Test
  void signup_createsSession_and_me_returnsUser() throws Exception {
    String email = "u-" + UUID.randomUUID() + "@example.com";
    String password = "demo-password";

    // Slice1 hardening: login/signup are CSRF-protected, bootstrap XSRF cookie first.
    MvcResult csrf = mvc.perform(get("/api/v1/auth/csrf"))
        .andExpect(status().isNoContent())
        .andExpect(cookie().exists("XSRF-TOKEN"))
        .andReturn();

    String xsrf = csrf.getResponse().getCookie("XSRF-TOKEN").getValue();
    jakarta.servlet.http.Cookie xsrfCookie = new jakarta.servlet.http.Cookie("XSRF-TOKEN", xsrf);

    MvcResult signup = mvc.perform(post("/api/v1/auth/signup")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password
            ))))
        .andExpect(status().isCreated())
        .andExpect(cookie().exists("JSESSIONID"))
        .andExpect(jsonPath("$.email").value(email))
        .andReturn();

    String sessionId = signup.getResponse().getCookie("JSESSIONID").getValue();

    mvc.perform(get("/api/v1/auth/me")
            .cookie(new jakarta.servlet.http.Cookie("JSESSIONID", sessionId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(email))
        .andExpect(jsonPath("$.id").isNumber());
  }

  @Test
  void signup_duplicateEmail_returnsConflict() throws Exception {
    String email = "u-" + UUID.randomUUID() + "@example.com";
    String password = "demo-password";

    // Slice1 hardening: login/signup are CSRF-protected, bootstrap XSRF cookie first.
    MvcResult csrf = mvc.perform(get("/api/v1/auth/csrf"))
        .andExpect(status().isNoContent())
        .andExpect(cookie().exists("XSRF-TOKEN"))
        .andReturn();

    String xsrf = csrf.getResponse().getCookie("XSRF-TOKEN").getValue();
    jakarta.servlet.http.Cookie xsrfCookie = new jakarta.servlet.http.Cookie("XSRF-TOKEN", xsrf);

    mvc.perform(post("/api/v1/auth/signup")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password
            ))))
        .andExpect(status().isCreated());

    mvc.perform(post("/api/v1/auth/signup")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password
            ))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error.code").value("CONFLICT"));
  }

  @Test
  void login_logout_flow_enforcesCsrf_forLogout() throws Exception {
    String email = "u-" + UUID.randomUUID() + "@example.com";
    String password = "demo-password";

    // Slice1 hardening: bootstrap CSRF cookie.
    MvcResult csrf = mvc.perform(get("/api/v1/auth/csrf"))
        .andExpect(status().isNoContent())
        .andExpect(cookie().exists("XSRF-TOKEN"))
        .andReturn();

    String xsrf = csrf.getResponse().getCookie("XSRF-TOKEN").getValue();
    jakarta.servlet.http.Cookie xsrfCookie = new jakarta.servlet.http.Cookie("XSRF-TOKEN", xsrf);

    mvc.perform(post("/api/v1/auth/signup")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password
            ))))
        .andExpect(status().isCreated());

    MvcResult login = mvc.perform(post("/api/v1/auth/login")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password
            ))))
        .andExpect(status().isOk())
        .andExpect(cookie().exists("JSESSIONID"))
        .andReturn();

    String sessionId = login.getResponse().getCookie("JSESSIONID").getValue();

    mvc.perform(post("/api/v1/auth/logout")
            .cookie(new jakarta.servlet.http.Cookie("JSESSIONID", sessionId))
            .cookie(xsrfCookie))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));

    mvc.perform(post("/api/v1/auth/logout")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(new jakarta.servlet.http.Cookie("JSESSIONID", sessionId))
            .cookie(xsrfCookie))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/v1/auth/me")
            .cookie(new jakarta.servlet.http.Cookie("JSESSIONID", sessionId)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void login_doesNotRevealWhetherUserExists() throws Exception {
    String email = "u-" + UUID.randomUUID() + "@example.com";
    String password = "demo-password";

    // Slice1 hardening: bootstrap CSRF cookie.
    MvcResult csrf = mvc.perform(get("/api/v1/auth/csrf"))
        .andExpect(status().isNoContent())
        .andExpect(cookie().exists("XSRF-TOKEN"))
        .andReturn();

    String xsrf = csrf.getResponse().getCookie("XSRF-TOKEN").getValue();
    jakarta.servlet.http.Cookie xsrfCookie = new jakarta.servlet.http.Cookie("XSRF-TOKEN", xsrf);

    mvc.perform(post("/api/v1/auth/signup")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password
            ))))
        .andExpect(status().isCreated());

    MvcResult wrongPassword = mvc.perform(post("/api/v1/auth/login")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", "wrong-password"
            ))))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
        .andReturn();

    MvcResult wrongEmail = mvc.perform(post("/api/v1/auth/login")
            .header("X-XSRF-TOKEN", xsrf)
            .cookie(xsrfCookie)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of(
                "email", "nope-" + UUID.randomUUID() + "@example.com",
                "password", "wrong-password"
            ))))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
        .andReturn();

    String msg1 = objectMapper.readTree(wrongPassword.getResponse().getContentAsString()).path("error").path("message").asText();
    String msg2 = objectMapper.readTree(wrongEmail.getResponse().getContentAsString()).path("error").path("message").asText();
    assertThat(msg1).isEqualTo("Invalid credentials.");
    assertThat(msg2).isEqualTo("Invalid credentials.");
  }
}
