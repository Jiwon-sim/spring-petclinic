# 🚀 K6 + Prometheus Remote Write 실습 정리

## 📋 실습 개요
Kubernetes 환경에서 k6 부하테스트와 Prometheus Remote Write를 활용한 실시간 모니터링 구성

## 🔧 1단계: k6 + Prometheus Remote Write 설정

### 파일 생성: `k6-prometheus-integration.yaml`
```yaml
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

    // 커스텀 메트릭 정의
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
      
      customSuccessRate.add(success);
      customResponseTime.add(response.timings.duration);
      if (!success) customErrors.add(1);
      
      sleep(1);
    }

---
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
          - experimental-prometheus-rw
          - /scripts/load-test.js
        env:
        - name: K6_PROMETHEUS_RW_SERVER_URL
          value: "http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090/api/v1/write"
        - name: K6_PROMETHEUS_RW_PUSH_INTERVAL
          value: "5s"
        - name: K6_PROMETHEUS_RW_TREND_STATS
          value: "p(50),p(95),p(99),avg,min,max"
        volumeMounts:
        - name: k6-script
          mountPath: /scripts
      volumes:
      - name: k6-script
        configMap:
          name: k6-prometheus-test-script
      restartPolicy: Never
```

## 🎨 2단계: Grafana 대시보드 생성

### 파일 생성: `k6-dashboard-fixed.json`
```json
{
  "dashboard": {
    "title": "K6 Load Test with Petclinic Monitoring - Fixed",
    "panels": [
      {
        "title": "Virtual Users Over Time",
        "targets": [{"expr": "k6_vus"}]
      },
      {
        "title": "HTTP Requests Rate", 
        "targets": [{"expr": "rate(k6_http_reqs_total[1m])"}]
      },
      {
        "title": "Response Time Percentiles",
        "targets": [
          {"expr": "k6_http_req_duration_p50"},
          {"expr": "k6_http_req_duration_p95"},
          {"expr": "k6_http_req_duration_p99"}
        ]
      },
      {
        "title": "Petclinic CPU Usage",
        "targets": [{"expr": "rate(container_cpu_usage_seconds_total{namespace=\"petclinic\", container=\"workload\", pod=~\"petclinic.*\"}[5m]) * 100"}]
      },
      {
        "title": "Petclinic Memory Usage",
        "targets": [{"expr": "container_memory_usage_bytes{namespace=\"petclinic\", container=\"workload\", pod=~\"petclinic.*\"} / 1024 / 1024"}]
      },
      {
        "title": "Custom K6 Metrics",
        "targets": [
          {"expr": "k6_custom_errors_total"},
          {"expr": "k6_custom_success_rate_rate"}
        ]
      }
    ]
  }
}
```

## 🚀 3단계: 실행 명령어

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
kubectl cp k6-dashboard-fixed.json monitoring/monitoring-grafana-xxxxx:/tmp/dashboard-final.json

# API를 통한 대시보드 Import
kubectl exec -n monitoring deployment/monitoring-grafana -- \
  curl -X POST -H "Content-Type: application/json" \
  -u admin:admin123! -d @/tmp/dashboard-final.json \
  http://localhost:3000/api/dashboards/db
```

## 📊 4단계: 모니터링 접속

### Grafana 접속 정보
- **URL**: https://grafana.bluesunnywings.com
- **로그인**: admin / admin123!
- **대시보드**: "K6 Load Test with Petclinic Monitoring - Fixed"

## 🔍 주요 메트릭

### k6 메트릭
```promql
k6_vus                           # 가상 사용자 수
rate(k6_http_reqs_total[1m])     # 초당 요청 수
k6_http_req_duration_p95         # 95% 응답시간
k6_custom_errors_total           # 커스텀 에러 수
k6_custom_success_rate_rate      # 성공률
```

### 애플리케이션 메트릭
```promql
# CPU 사용률
rate(container_cpu_usage_seconds_total{namespace="petclinic", container="workload", pod=~"petclinic.*"}[5m]) * 100

# 메모리 사용량
container_memory_usage_bytes{namespace="petclinic", container="workload", pod=~"petclinic.*"} / 1024 / 1024
```

## 🛠️ 문제 해결 과정

### 1. NoData 문제 해결
- **문제**: 잘못된 메트릭 이름과 라벨 사용
- **해결**: Prometheus API로 실제 메트릭 이름 확인 후 수정

### 2. 컨테이너 이름 확인
```bash
kubectl get pods -n petclinic -o jsonpath='{.items[*].spec.containers[*].name}'
# 결과: postgresql k6 workload
```

### 3. 메트릭 이름 확인
```bash
kubectl exec -n monitoring prometheus-xxx -- \
  wget -qO- 'http://localhost:9090/api/v1/label/__name__/values' | grep k6
```

## 📁 생성된 파일 목록
- `k6-prometheus-integration.yaml` - k6 테스트 및 Prometheus Remote Write 설정
- `k6-dashboard-fixed.json` - 수정된 Grafana 대시보드
- `run-k6-prometheus-test.sh` - 테스트 실행 스크립트
- `K6-PROMETHEUS-HANDS-ON.md` - 상세 가이드 문서

## 🧹 리소스 정리

### 자동 정리 스크립트
```bash
# 실행 권한 부여
chmod +x cleanup-k6-resources.sh

# 리소스 정리 실행
./cleanup-k6-resources.sh
```

### 수동 정리 명령어
```bash
# 1. K6 Job 삭제
kubectl delete job k6-prometheus-load-test -n petclinic

# 2. K6 ConfigMap 삭제
kubectl delete configmap k6-prometheus-test-script -n petclinic

# 3. K6 ServiceMonitor 삭제
kubectl delete servicemonitor k6-metrics -n petclinic

# 4. 기존 K6 테스트 리소스 삭제
kubectl delete -f k6-monitoring-test.yaml

# 5. K6 관련 Pod 강제 삭제 (필요시)
kubectl delete pods -n petclinic -l app=k6-load-test --force --grace-period=0

# 6. 정리 확인
kubectl get pods,jobs,configmaps -n petclinic | grep k6
```

### Grafana 대시보드 삭제
```bash
# 대시보드 삭제 (필요시)
kubectl exec -n monitoring deployment/monitoring-grafana -- \
  curl -X DELETE -u admin:admin123! \
  http://localhost:3000/api/dashboards/uid/52d66022-7acd-4f52-9ddf-32276cb9c7b0
```

### 생성된 파일 정리
```bash
# 실습 중 생성된 파일들 삭제
rm -f k6-prometheus-integration.yaml
rm -f k6-dashboard-fixed.json
rm -f k6-grafana-dashboard-enhanced.json
rm -f run-k6-prometheus-test.sh
rm -f cleanup-k6-resources.sh
rm -f import-dashboard.sh
```

## ✅ 최종 결과
- k6 부하테스트가 Prometheus Remote Write를 통해 실시간 메트릭 전송
- Grafana 대시보드에서 k6 메트릭과 애플리케이션 메트릭 통합 모니터링
- 모든 패널에서 정상적으로 데이터 표시
- 완전한 리소스 정리 방법 제공