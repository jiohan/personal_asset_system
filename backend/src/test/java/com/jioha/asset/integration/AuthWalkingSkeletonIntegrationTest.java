package com.jioha.asset.integration;

import com.jioha.asset.api.auth.AuthController;
import com.jioha.asset.api.auth.AuthService;
import com.jioha.asset.api.auth.EmailAlreadyExistsException;
import com.jioha.asset.api.auth.SessionUser;
import com.jioha.asset.api.common.GlobalExceptionHandler;
import com.jioha.asset.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AuthController.class, properties = "spring.session.store-type=none")
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class AuthWalkingSkeletonIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @MockBean
  private AuthService authService;

  @Test
  void signup_then_me_returns_authenticated_user() throws Exception {
    when(authService.signup("demo@local.dev", "demo12345"))
        .thenReturn(new SessionUser(1L, "demo@local.dev"));

    MvcResult signupResult = mockMvc.perform(post("/api/v1/auth/signup")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "demo@local.dev",
                  "password": "demo12345"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.email").value("demo@local.dev"))
        .andReturn();

    MockHttpSession session = (MockHttpSession) signupResult.getRequest().getSession(false);
    assertThat(session).isNotNull();

    mockMvc.perform(get("/api/v1/auth/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.email").value("demo@local.dev"));
  }

  @Test
  void me_requires_authentication() throws Exception {
    mockMvc.perform(get("/api/v1/auth/me"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
  }

  @Test
  void login_then_me_returns_authenticated_user() throws Exception {
    when(authService.authenticate("demo@local.dev", "demo12345"))
        .thenReturn(new SessionUser(1L, "demo@local.dev"));

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

    MockHttpSession session = (MockHttpSession) loginResult.getRequest().getSession(false);
    assertThat(session).isNotNull();

    mockMvc.perform(get("/api/v1/auth/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.email").value("demo@local.dev"));
  }

  @Test
  void signup_returns_conflict_when_email_exists() throws Exception {
    when(authService.signup("demo@local.dev", "demo12345"))
        .thenThrow(new EmailAlreadyExistsException());

    mockMvc.perform(post("/api/v1/auth/signup")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "email": "demo@local.dev",
                  "password": "demo12345"
                }
                """))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error.code").value("CONFLICT"));
  }
}
