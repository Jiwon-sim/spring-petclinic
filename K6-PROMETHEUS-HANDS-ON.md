# 🚀 K6 + Prometheus Remote Write 핸즈온 가이드

## 📋 개요
Kubernetes 환경에서 k6 부하테스트와 Prometheus Remote Write를 활용한 실시간 모니터링 구성

## 🏗️ 아키텍처
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   k6 Pod        │───▶│   Prometheus    │───▶│    Grafana      │
│ (Load Testing)  │    │ (Remote Write)  │    │  (Dashboard)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Petclinic App  │    │   Metrics DB    │    │  Real-time UI   │
│   (Target)      │    │   (Storage)     │    │   (Monitoring)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 1단계: k6 + Prometheus Remote Write 설정

### 파일 생성: `k6-prometheus-integration.yaml`
```yaml
# ConfigMap: k6 테스트 스크립트
apiVersion: v1
kind: ConfigMap
metadata:
  name: k6-prometheus-test-script
  namespace: petclinic
data:
  load-test.js: |
    import http from 'k6/http';
    import { check, sleep } from 'k6';
    import { Counter, Rate, Trend } from 'k6/metrics';

    // 커스텀 메트릭 정의 (Prometheus로 전송됨)
    const customErrors = new Counter('custom_errors');
    const customSuccessRate = new Rate('custom_success_rate');
    const customResponseTime = new Trend('custom_response_time');

    export let options = {
      stages: [
        { duration: '2m', target: 10 },   // 워밍업
        { duration: '5m', target: 30 },   // 정상 부하
        { duration: '3m', target: 50 },   // 피크 부하
        { duration: '5m', target: 50 },   // 지속 테스트
        { duration: '2m', target: 0 },    // 쿨다운
      ],
      thresholds: {
        http_req_duration: ['p(95)<1000', 'p(99)<2000'],
        http_req_failed: ['rate<0.05'],
        custom_success_rate: ['rate>0.95'],
      },
    };

    const BASE_URL = 'https://petclinic.bluesunnywings.com';

    export default function () {
      // 메인 페이지 테스트
      const response = http.get(`${BASE_URL}/`);
      const success = check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 1000ms': (r) => r.timings.duration < 1000,
      });
      
      // 커스텀 메트릭 기록
      customSuccessRate.add(success);
      customResponseTime.add(response.timings.duration);
      if (!success) customErrors.add(1);
      
      sleep(1);
    }

---
# Job: k6 부하테스트 실행
apiVersion: batch/v1
kind: Job
metadata:
  name: k6-prometheus-load-test
  namespace: petclinic
spec:
  template:
    spec:
      containers:
      - name: k6
        image: grafana/k6:latest
        command: 
          - k6
          - run
          - --out
          - experimental-prometheus-rw  # Prometheus Remote Write 활성화
          - /scripts/load-test.js
        env:
        # Prometheus Remote Write 설정
        - name: K6_PROMETHEUS_RW_SERVER_URL
          value: "http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090/api/v1/write"
        - name: K6_PROMETHEUS_RW_PUSH_INTERVAL
          value: "5s"  # 5초마다 메트릭 전송
        - name: K6_PROMETHEUS_RW_TREND_STATS
          value: "p(50),p(95),p(99),avg,min,max"  # 전송할 통계
        volumeMounts:
        - name: k6-script
          mountPath: /scripts
      volumes:
      - name: k6-script
        configMap:
          name: k6-prometheus-test-script
      restartPolicy: Never
```

**역할 설명:**
- **ConfigMap**: k6 테스트 스크립트 저장
- **Job**: k6 컨테이너 실행 및 Prometheus Remote Write 설정
- **Remote Write**: k6 메트릭을 Prometheus로 실시간 전송

## 🎨 2단계: Grafana 대시보드 생성

### 파일 생성: `k6-grafana-dashboard-enhanced.json`
```json
{
  "dashboard": {
    "title": "K6 Load Test with Petclinic Monitoring",
    "panels": [
      {
        "title": "Virtual Users Over Time",
        "targets": [
          {
            "expr": "k6_vus",
            "legendFormat": "Active VUs"
          }
        ]
      },
      {
        "title": "HTTP Requests Rate",
        "targets": [
          {
            "expr": "rate(k6_http_reqs_total[1m])",
            "legendFormat": "Requests/sec"
          }
        ]
      },
      {
        "title": "Response Time Percentiles",
        "targets": [
          {
            "expr": "k6_http_req_duration{quantile=\"0.95\"}",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Petclinic CPU Usage",
        "targets": [
          {
            "expr": "rate(container_cpu_usage_seconds_total{namespace=\"petclinic\"}[5m]) * 100",
            "legendFormat": "{{pod}} CPU %"
          }
        ]
      }
    ]
  }
}
```

**역할 설명:**
- **k6 메트릭**: VU, 요청률, 응답시간 시각화
- **애플리케이션 메트릭**: CPU, 메모리 사용률 모니터링
- **통합 뷰**: 부하테스트와 시스템 성능 동시 확인

## 🚀 3단계: 실행 및 모니터링

### 1. k6 테스트 배포
```bash
kubectl apply -f k6-prometheus-integration.yaml
```

### 2. 테스트 상태 확인
```bash
kubectl get pods -n petclinic -l app=k6-load-test
kubectl logs k6-prometheus-load-test-xxxxx -n petclinic
```

### 3. Grafana 대시보드 Import
```bash
# 대시보드 파일을 Grafana Pod에 복사
kubectl cp k6-grafana-dashboard-enhanced.json monitoring/monitoring-grafana-xxxxx:/tmp/dashboard.json

# API를 통한 대시보드 Import
kubectl exec -n monitoring deployment/monitoring-grafana -- \
  curl -X POST -H "Content-Type: application/json" \
  -u admin:admin123! -d @/tmp/dashboard.json \
  http://localhost:3000/api/dashboards/db
```

## 📊 4단계: 실시간 모니터링

### Grafana 접속
- **URL**: https://grafana.bluesunnywings.com
- **로그인**: admin / admin123!
- **대시보드**: "K6 Load Test with Petclinic Monitoring"

### 주요 메트릭
```promql
# k6 메트릭
k6_vus                                    # 가상 사용자 수
rate(k6_http_reqs_total[1m])             # 초당 요청 수
k6_http_req_duration{quantile="0.95"}    # 95% 응답시간

# 애플리케이션 메트릭
rate(container_cpu_usage_seconds_total[5m]) * 100  # CPU 사용률
container_memory_usage_bytes / 1024 / 1024         # 메모리 사용량
```

## 🔍 각 구성 요소 역할

### 1. **k6 (부하테스트 도구)**
- HTTP 요청 생성 및 성능 측정
- 가상 사용자(VU) 시뮬레이션
- 커스텀 메트릭 생성

### 2. **Prometheus Remote Write**
- k6 메트릭을 Prometheus로 실시간 전송
- 시계열 데이터 저장
- 5초 간격 메트릭 푸시

### 3. **Prometheus (메트릭 저장소)**
- k6 메트릭 수집 및 저장
- 애플리케이션 메트릭과 통합
- PromQL 쿼리 지원

### 4. **Grafana (시각화)**
- 실시간 대시보드 제공
- k6 + 애플리케이션 메트릭 통합 뷰
- 알림 및 분석 기능

## 🎯 핵심 장점

1. **실시간 모니터링**: 부하테스트 중 시스템 상태 즉시 확인
2. **통합 뷰**: k6 메트릭과 애플리케이션 메트릭 동시 모니터링
3. **자동화**: Kubernetes Job으로 반복 실행 가능
4. **확장성**: 다양한 테스트 시나리오 추가 가능
5. **데이터 보존**: Prometheus에 메트릭 영구 저장

## 📈 결과 분석

### 성능 지표
- **응답시간**: P50, P95, P99 백분위수
- **처리량**: RPS (Requests Per Second)
- **오류율**: HTTP 4xx/5xx 비율
- **리소스 사용률**: CPU, 메모리, 네트워크

### 병목점 식별
- k6 부하 증가 시 CPU/메모리 사용률 변화
- 응답시간 증가 구간 분석
- 시스템 한계점 확인