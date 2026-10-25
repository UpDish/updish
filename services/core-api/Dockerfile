FROM eclipse-temurin:25-jre
WORKDIR /app
COPY build/libs/core-api-0.0.1-SNAPSHOT.jar app.jar
USER 10001
ENV SERVER_ADDRESS=0.0.0.0
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
