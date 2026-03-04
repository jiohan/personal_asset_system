package com.jioha.asset.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
public class SessionCookieConfig {

  @Bean
  public CookieSerializer cookieSerializer(
      @Value("${app.security.session-cookie.use-http-only-cookie:true}") boolean useHttpOnlyCookie,
      @Value("${app.security.session-cookie.use-secure-cookie:false}") boolean useSecureCookie,
      @Value("${app.security.session-cookie.same-site:Lax}") String sameSite) {
    // Slice1 hardening: Spring Session defaults to cookie name "SESSION"; align to contract "JSESSIONID".
    DefaultCookieSerializer serializer = new DefaultCookieSerializer();
    serializer.setCookieName("JSESSIONID");
    serializer.setCookiePath("/");
    serializer.setUseHttpOnlyCookie(useHttpOnlyCookie);
    serializer.setUseSecureCookie(useSecureCookie);
    serializer.setSameSite(sameSite);
    return serializer;
  }
}
