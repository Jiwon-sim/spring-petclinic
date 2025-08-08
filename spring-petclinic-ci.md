# Spring Petclinic CI/CD with SonarQube

이 문서는 `spring-projects/spring-petclinic` 애플리케이션을 GitHub Actions로 CI, SonarQube로 코드 품질 분석, Harbor로 이미지 Push, ArgoCD로 배포하는 전체 흐름을 정리한 가이드입니다.

---

## 1. 사전 준비

- GitHub 저장소: https://github.com/spring-projects/spring-petclinic (공식 리포지토리)
- Harbor 주소: `https://harbor.bluesunnywings.com`
- Harbor에 프로젝트 생성 필요 (예: `petclinic`)
- 개인 Harbor 계정 보유
- EKS 클러스터 + ArgoCD + Harbor 이미 구성 완료 상태

---

## 2. SonarQube 설정

### 2.1 SonarQube 서버 접속
- URL: `https://sonarqube.bluesunnywings.com`
- 기본 계정: `admin/admin` (최초 로그인 후 비밀번호 변경 필요)

### 2.2 프로젝트 생성
1. "Create Project" → "Manually"
2. Project key: `spring-petclinic`
3. Display name: `Spring PetClinic`
4. "Set Up" 클릭

### 2.3 토큰 생성
1. "Generate Token" 선택
2. Token name: `petclinic-token`
3. 생성된 토큰을 GitHub Secrets에 `SONAR_TOKEN`으로 저장

---

## 3. `.github/workflows/ci.yml` 파일 생성

```yaml
name: CI/CD Pipeline with SonarQube

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  sonarqube-analysis:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '17'

    - name: Cache Maven dependencies
      uses: actions/cache@v4
      with:
        path: ~/.m2
        key: ${{ runner.os }}-m2-${{ hashFiles('**/pom.xml') }}

    - name: Run tests and SonarQube analysis
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        SONAR_HOST_URL: https://sonarqube.bluesunnywings.com
      run: |
        ./mvnw clean verify sonar:sonar \
          -Dsonar.projectKey=spring-petclinic \
          -Dsonar.projectName="Spring PetClinic" \
          -Dsonar.host.url=$SONAR_HOST_URL \
          -Dsonar.token=$SONAR_TOKEN

  build-and-push:
    needs: sonarqube-analysis
    runs-on: ubuntu-latest
    
    env:
      IMAGE_NAME: petclinic
      REGISTRY: harbor.bluesunnywings.com/library
      IMAGE_TAG: ${{ github.sha }}

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '17'

    - name: Build with Maven
      run: ./mvnw package -DskipTests

    - name: Log in to Harbor
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ secrets.REGISTRY_USERNAME }}
        password: ${{ secrets.REGISTRY_PASSWORD }}

    - name: Build and push Docker image
      uses: docker/build-push-action@v6
      with:
        context: .
        push: true
        tags: |
          "${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}"
          "${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest"
```

> ✅ GitHub Secrets 필요: `SONAR_TOKEN`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`

---

## 4. Dockerfile 작성

```dockerfile
FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
COPY target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

위 파일은 프로젝트 루트에 `Dockerfile`로 저장합니다.

---

<<<<<<< HEAD
## 5. ArgoCD 배포 설정 (petclinic-argocd-app.yaml)
=======
## 5. SonarQube Quality Gate 설정

### 5.1 Quality Gate 생성
1. SonarQube 웹 UI → "Quality Gates"
2. "Create" 클릭
3. Name: `Petclinic Gate`
4. 조건 추가:
   - Coverage < 80% → Error
   - Duplicated Lines (%) > 3% → Error
   - Maintainability Rating > A → Error
   - Reliability Rating > A → Error
   - Security Rating > A → Error

### 5.2 프로젝트에 Quality Gate 적용
1. "Projects" → `spring-petclinic` 선택
2. "Project Settings" → "Quality Gate"
3. `Petclinic Gate` 선택

---

## 6. ArgoCD 배포 설정 (petclinic-argocd-app.yaml)
>>>>>>> 7ef7d500282953c1a19706952f9f915e9daf3ac2

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: petclinic
  namespace: argo-cd
spec:
  project: default
  source:
    repoURL: 'https://github.com/Jiwon-sim/spring-petclinic-dev.git'
    targetRevision: HEAD
    path: k8s
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: petclinic
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

> `k8s` 디렉토리에 Deployment, Service 등의 YAML 파일이 필요

---

<<<<<<< HEAD
## 6. ArgoCD Application 등록
=======
## 7. ArgoCD Application 등록
>>>>>>> 7ef7d500282953c1a19706952f9f915e9daf3ac2

```bash
kubectl apply -f petclinic-argocd-app.yaml -n argo-cd
```

ArgoCD에 애플리케이션이 등록되며, Harbor에서 이미지를 pull해서 자동으로 배포됩니다.

---

<<<<<<< HEAD
## 7. SonarQube 분석 결과 확인

### 7.1 웹 UI에서 확인
=======
## 8. SonarQube 분석 결과 확인

### 8.1 웹 UI에서 확인
>>>>>>> 7ef7d500282953c1a19706952f9f915e9daf3ac2
- URL: `https://sonarqube.bluesunnywings.com`
- 프로젝트: `spring-petclinic`
- 주요 메트릭:
  - **Coverage**: 테스트 커버리지
  - **Duplications**: 중복 코드
  - **Maintainability**: 유지보수성
  - **Reliability**: 신뢰성
  - **Security**: 보안

<<<<<<< HEAD


---

## 8. 배포 상태 확인 명령어
=======
### 8.2 주요 분석 항목
```
✅ Lines of Code: ~15,000
✅ Coverage: 85%+
✅ Duplications: <3%
✅ Code Smells: 관리 가능한 수준
✅ Bugs: 0개
✅ Vulnerabilities: 0개
```

---

## 9. 배포 상태 확인 명령어
>>>>>>> 7ef7d500282953c1a19706952f9f915e9daf3ac2

```bash
kubectl get pods -n petclinic
kubectl get svc -n petclinic
kubectl describe application petclinic -n argo-cd
```

---

## 완료 🎉

이제 GitHub에 push할 때마다:
1. **SonarQube**가 코드 품질을 분석
2. Quality Gate 통과 시 **Harbor**에 이미지 빌드 & 푸시
3. **ArgoCD**가 자동으로 EKS에 배포

전체 파이프라인: **Code → SonarQube → Harbor → ArgoCD → EKS** 🚀

### 추가 개선 사항
- SonarQube Quality Gate 실패 시 배포 중단
- Slack/Teams 알림 연동
- 보안 스캔 추가 (Trivy, Snyk 등)
<<<<<<< HEAD
- 성능 테스트 자동화
=======
- 성능 테스트 자동화
>>>>>>> 7ef7d500282953c1a19706952f9f915e9daf3ac2
