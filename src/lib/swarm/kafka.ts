import { Kafka, logLevel, type Producer } from "kafkajs";
import { getKafkaConfig, isKafkaEnabled } from "./config";
import type { SwarmEventEnvelope } from "./session";

let kafkaClient: Kafka | null = null;
let producerClient: Producer | null = null;
let producerPromise: Promise<Producer> | null = null;

function getKafka() {
  if (!kafkaClient) {
    const config = getKafkaConfig();
    kafkaClient = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl,
      connectionTimeout: config.connectionTimeoutMs,
      requestTimeout: config.requestTimeoutMs,
      retry: {
        initialRetryTime: 300,
        retries: config.retryCount,
      },
      logLevel: process.env.KAFKA_LOG_LEVEL === "debug" ? logLevel.DEBUG : logLevel.ERROR,
    });
  }
  return kafkaClient;
}

function getProducer() {
  if (!producerPromise) {
    const producer = getKafka().producer({
      // Topics are provisioned by infrastructure, never implicitly by app traffic.
      allowAutoTopicCreation: false,
      idempotent: true,
      maxInFlightRequests: 5,
    });
    producerClient = producer;
    producerPromise = producer.connect().then(
      () => producer,
      (error) => {
        producerClient = null;
        producerPromise = null;
        producer.disconnect().catch(() => undefined);
        throw error;
      },
    );
  }
  return producerPromise;
}

/**
 * Mirrors an event to Kafka. Returns false without touching the network when
 * Kafka is not configured, so minimal deployments never attempt a connection.
 */
export async function publishSwarmEvent(envelope: SwarmEventEnvelope): Promise<boolean> {
  if (!isKafkaEnabled()) return false;
  const producer = await getProducer();
  const { topic, requestTimeoutMs } = getKafkaConfig();

  await producer.send({
    topic,
    acks: -1,
    timeout: requestTimeoutMs,
    messages: [
      {
        key: envelope.runId,
        value: JSON.stringify(envelope),
        timestamp: String(envelope.occurredAt),
        headers: {
          eventKind: envelope.event.kind,
          eventVersion: String(envelope.version),
          eventId: envelope.id,
        },
      },
    ],
  });
  return true;
}

/** Checks broker connectivity and verifies that the required topic exists. */
export async function pingKafka() {
  const kafka = getKafka();
  const { topic } = getKafkaConfig();
  const admin = kafka.admin();
  await admin.connect();
  try {
    const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
    if (!metadata.topics.some((entry) => entry.name === topic)) {
      throw new Error(`Kafka topic ${topic} does not exist.`);
    }
  } finally {
    await admin.disconnect();
  }
}

export async function disconnectKafka() {
  const producer = producerClient;
  producerClient = null;
  producerPromise = null;
  kafkaClient = null;
  if (producer) await producer.disconnect();
}
