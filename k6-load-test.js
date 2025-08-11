import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 10 },  // 30초 동안 10명까지 증가
    { duration: '1m', target: 20 },   // 1분 동안 20명 유지
    { duration: '30s', target: 0 },   // 30초 동안 0명까지 감소
  ],
};

// 애플리케이션 URL (NodePort 서비스 접근)
const BASE_URL = 'http://localhost:30080'; // NodePort 확인 후 수정 필요

export default function () {
  // 메인 페이지 테스트
  let response = http.get(`${BASE_URL}/`);
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // 수의사 목록 페이지 테스트
  response = http.get(`${BASE_URL}/vets`);
  check(response, {
    'vets page status is 200': (r) => r.status === 200,
    'vets page response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);

  // 소유자 검색 페이지 테스트
  response = http.get(`${BASE_URL}/owners/find`);
  check(response, {
    'owners find page status is 200': (r) => r.status === 200,
  });

  sleep(1);
}