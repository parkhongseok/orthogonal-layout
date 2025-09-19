// (todo) add a real test runner (vitest/jest). placeholder.
import { PriorityQueue } from '../../src/utils/priorityQueue';
const pq = new PriorityQueue<number>((a,b)=>a-b);
[pq.push(3), pq.push(1), pq.push(2)];
console.assert(pq.pop() === 1);
console.assert(pq.pop() === 2);
console.assert(pq.pop() === 3);
