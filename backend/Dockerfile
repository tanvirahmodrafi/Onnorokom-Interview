# ---- build: restore and publish inside the container (no local .NET SDK needed) ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY SchoolAdmission.sln ./
COPY src/SchoolAdmission.Api/SchoolAdmission.Api.csproj src/SchoolAdmission.Api/
COPY tests/SchoolAdmission.Tests/SchoolAdmission.Tests.csproj tests/SchoolAdmission.Tests/
RUN dotnet restore SchoolAdmission.sln
COPY . .
RUN dotnet publish src/SchoolAdmission.Api/SchoolAdmission.Api.csproj -c Release -o /app --no-restore

# ---- test: used by `docker compose --profile test run --rm backend-tests` ----
FROM build AS test
ENTRYPOINT ["dotnet", "test", "tests/SchoolAdmission.Tests/SchoolAdmission.Tests.csproj", "--no-restore", "--logger", "console;verbosity=normal"]

# ---- runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app .
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
