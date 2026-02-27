package com.jioha.asset.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jioha.asset.api.ApiErrorResponse;
import com.jioha.asset.api.ApiErrorResponse.ApiError;
import com.jioha.asset.auth.UserRepository;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.util.StringUtils;

import jakarta.servlet.http.HttpServletRequest;
import java.util.function.Supplier;
import org.springframework.security.web.csrf.CsrfToken;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  public UserDetailsService userDetailsService(UserRepository userRepository) {
    return (username) -> userRepository.findByEmailNormalized(normalizeEmail(username))
        .map((u) -> new com.jioha.asset.auth.AuthUserDetails(
            u.getId(),
            u.getEmail(),
            u.getEmailNormalized(),
            u.getPasswordHash()))
        .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException("User not found"));
  }

  @Bean
  public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
    return configuration.getAuthenticationManager();
  }

  @Bean
  public SecurityContextRepository securityContextRepository() {
    return new HttpSessionSecurityContextRepository();
  }

  @Bean
  public CsrfTokenRepository csrfTokenRepository() {
    CookieCsrfTokenRepository repo = CookieCsrfTokenRepository.withHttpOnlyFalse();
    repo.setCookieName("XSRF-TOKEN");
    repo.setHeaderName("X-XSRF-TOKEN");
    return repo;
  }

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http,
      CsrfTokenRepository csrfTokenRepository,
      SecurityContextRepository securityContextRepository,
      ObjectMapper objectMapper) throws Exception {

    http.securityContext((sc) -> sc.securityContextRepository(securityContextRepository));

    http.csrf((csrf) -> csrf
        .csrfTokenRepository(csrfTokenRepository)
        // Slice1 hardening: align SPA CSRF handling with Spring Security reference.
        .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler()));

    http.sessionManagement((sm) -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED));

    http.authorizeHttpRequests((auth) -> auth
        .requestMatchers("/api/v1/auth/signup", "/api/v1/auth/login", "/api/v1/auth/csrf").permitAll()
        .anyRequest().authenticated());

    http.exceptionHandling((eh) -> eh
        .authenticationEntryPoint((request, response, authException) -> writeError(response, objectMapper, 401, "UNAUTHORIZED", "Unauthorized."))
        .accessDeniedHandler((request, response, accessDeniedException) -> writeError(response, objectMapper, 403, "FORBIDDEN", "Forbidden.")));

    http.httpBasic((hb) -> hb.disable());
    http.formLogin((fl) -> fl.disable());
    http.logout((lo) -> lo.disable());

    return http.build();
  }

  private static void writeError(HttpServletResponse response, ObjectMapper objectMapper, int status, String code, String message)
      throws IOException {
    response.setStatus(status);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    objectMapper.writeValue(response.getOutputStream(), new ApiErrorResponse(new ApiError(code, message, null)));
  }

  private static String normalizeEmail(String email) {
    if (email == null) return "";
    return email.trim().toLowerCase(Locale.ROOT);
  }

  // Slice1 hardening: official SPA example - use plain token when header is present (cookie -> header).
  static final class SpaCsrfTokenRequestHandler implements CsrfTokenRequestHandler {
    private final CsrfTokenRequestHandler plain = new CsrfTokenRequestAttributeHandler();
    private final CsrfTokenRequestHandler xor = new XorCsrfTokenRequestAttributeHandler();

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, Supplier<CsrfToken> csrfToken) {
      this.xor.handle(request, response, csrfToken);
      csrfToken.get();
    }

    @Override
    public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken csrfToken) {
      String headerValue = request.getHeader(csrfToken.getHeaderName());
      return (StringUtils.hasText(headerValue) ? this.plain : this.xor).resolveCsrfTokenValue(request, csrfToken);
    }
  }
}
