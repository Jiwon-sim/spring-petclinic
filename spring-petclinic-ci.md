# Spring Petclinic CI/CD

이 문서는 `spring-projects/spring-petclinic` 애플리케이션을 GitHub Actions로 CI, Harbor로 이미지 Push, ArgoCD로 배포하는 전체 흐름을 정리한 가이드입니다.

---

## 1. 사전 준비

- GitHub 저장소: https://github.com/spring-projects/spring-petclinic (공식 리포지토리)
- Harbor 주소: `https://harbor.bluesunnywings.com`
- Harbor에 프로젝트 생성 필요 (예: `petclinic`)
- 개인 Harbor 계정 보유
- EKS 클러스터 + ArgoCD + Harbor 이미 구성 완료 상태

---

## 2. `.github/workflows/ci.yml` 파일 생성

```yaml
name: CI/CD Pipeline for Spring Boot App

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build-and-push:
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

> ✅ `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`는 GitHub repository secret에 미리 저장해야 합니다.

---

## 3. Dockerfile 작성

```dockerfile
FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
COPY target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

위 파일은 프로젝트 루트에 `Dockerfile`로 저장합니다.

---

## 4. ArgoCD 배포 설정 (petclinic-argocd-app.yaml)

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

## 5. ArgoCD Application 등록

```bash
kubectl apply -f petclinic-argocd-app.yaml -n argo-cd
```

ArgoCD에 애플리케이션이 등록되며, Harbor에서 이미지를 pull해서 자동으로 배포됩니다.

---

## 6. 배포 상태 확인 명령어

```bash
kubectl get pods -n petclinic
kubectl get svc -n petclinic
kubectl describe application petclinic -n argo-cd
```

---

## 완료 🎉

이제 GitHub에 push할 때마다 CI/CD가 자동으로 수행되어 Harbor에 이미지가 올라가고, ArgoCD가 이를 감지하여 자동 배포합니다.