import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { mobileClient } from "../api/client";
import type { PaymentBalance, PaymentTransaction } from '~/types';
import { formatCurrency } from '../utils/currency';

export function PaymentsScreen() {
  const [balance, setBalance] = useState<PaymentBalance | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [earnings, setEarnings] = useState<{ amount: number; currency: string } | null>(null);
  const [status, setStatus] = useState("");

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const [balanceData, transactionData, earningsData] = await Promise.all([
            mobileClient.getPaymentBalance(),
            mobileClient.getPaymentTransactions(),
            mobileClient.getPaymentEarnings(),
          ]);
          setBalance(balanceData);
          setTransactions(transactionData.transactions || []);
          setEarnings(earningsData);
        } catch (err) {
          setStatus("Unable to load payment data.");
        }
      };
      load();
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Payments</Text>
      {balance ? (
        <View style={styles.card}>
          <Text style={styles.label}>Total Balance</Text>
          <Text style={styles.value}>
            {formatCurrency(balance.balance, balance.currency)}
          </Text>
        </View>
      ) : null}
      {earnings ? (
        <View style={styles.card}>
          <Text style={styles.label}>Available for payout</Text>
          <Text style={styles.value}>
            {formatCurrency(earnings.amount, earnings.currency)}
          </Text>
        </View>
      ) : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Text style={styles.sectionTitle}>Recent transactions</Text>
      <FlatList
        data={transactions.slice(0, 20)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.type}</Text>
            <Text style={styles.subtitle}>
              {formatCurrency(item.amount, item.currency)} · {item.status}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.status}>No transactions yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F9FAFB",
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  label: {
    color: "#6B7280",
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  title: {
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    color: "#6B7280",
    marginTop: 4,
  },
  status: {
    color: "#6B7280",
    marginBottom: 12,
  },
});
