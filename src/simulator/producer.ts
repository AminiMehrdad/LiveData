import 'dotenv/config';
import { connect } from 'amqp-connection-manager';

const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const EXCHANGE = 'amq.topic';
const ROUTING_KEY = 'production';

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function generatePayload(wellName = 'Well-1') {
  const now = new Date();
  return {
    timestamp: now.toISOString(),
    wellName,
    temperature_down: parseFloat(randomBetween(60, 120).toFixed(2)),
    pressure_top: parseFloat(randomBetween(10, 80).toFixed(2)),
    oil: parseFloat(randomBetween(0, 200).toFixed(2)),
    gas: parseFloat(randomBetween(0, 5000).toFixed(2)),
    water: parseFloat(randomBetween(0, 100).toFixed(2)),
  };
}

async function run() {
  const connection = connect([RABBIT_URL]);
  const channelWrapper = connection.createChannel({
    json: false,
    setup: async (channel) => {
      await channel.assertExchange(EXCHANGE, 'topic', { durable: false });
    },
  });

  channelWrapper.on('connect', () => console.log('Producer connected to RabbitMQ'));
  channelWrapper.on('disconnect', (err: any) => console.error('Producer disconnected', err));

  const wells = ['Well-1', 'Well-2', 'Well-3'];
  let idx = 0;

  setInterval(async () => {
    const payload = generatePayload(wells[idx % wells.length]);
    idx++;
    try {
      channelWrapper.publish(EXCHANGE, ROUTING_KEY, Buffer.from(JSON.stringify(payload)), {
        persistent: false,
        contentType: 'application/json',
      });
      console.log('Published:', payload.timestamp, payload.wellName);
    } catch (err) {
      console.error('Publish error', err);
    }
  }, 10_000);
}

run().catch((err) => {
  console.error('Producer error', err);
  process.exit(1);
});
