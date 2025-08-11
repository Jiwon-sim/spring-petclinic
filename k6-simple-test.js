import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 5,        // 5명의 가상 사용자
  duration: '30s', // 30초 동안 실행
};

export default function () {
  // NodePort 서비스 URL (실제 포트로 수정 필요)
  let response = http.get('http://localhost:30080/');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });
}