import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { useFocusEffect } from '@react-navigation/native';
import { mobileClient } from "../api/client";
import { useAuth } from "../api/authContext";
import type { PaymentBalance, PaymentTransaction } from '~/types';
import { formatCurrency } from '../utils/currency';

export function OwnerEarningsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<PaymentBalance | null>(null);
  const [earnings, setEarnings] = useState<{ amount: number; currency: string } | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [status, setStatus] = useState("");

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!user) return;
        setLoading(true);
        setStatus("");
        try {
          const [balanceRes, earningsRes, txRes] = await Promise.all([
            mobileClient.getPaymentBalance(),
            mobileClient.getPaymentEarnings(),
            mobileClient.getPaymentTransactions(1, 10),
          ]);
          setBalance(balanceRes);
          setEarnings(earningsRes);
          setTransactions(txRes.transactions || []);
        } catch (err) {
          setStatus("Unable to load earnings data.");
        } finally {
          setLoading(false);
        }
      };

      load();
    }, [user])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Owner Earnings</Text>
      {!user ? (
        <Text style={styles.status}>Sign in to view earnings.</Text>
      ) : loading ? (
        <ActivityIndicator size="small" color="#111827" />
      ) : (
        <>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          {balance && earnings && (
            <View style={styles.card}>
              <Text style={styles.label}>Available for Payout</Text>
              <Text style={styles.value}>
                {formatCurrency(earnings.amount, earnings.currency)}
              </Text>
              <Text style={styles.label}>Total Balance</Text>
              <Text style={styles.value}>
                {formatCurrency(balance.balance, balance.currency)}
              </Text>
            </View>
          )}
          <Text style={styles.section}>Recent Transactions</Text>
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.transaction}>
                <Text style={styles.transactionTitle}>{item.type}</Text>
                <Text style={styles.transactionMeta}>{item.description || item.status}</Text>
                <Text style={styles.transactionAmount}>
                  {formatCurrency(item.amount, item.currency)}
                </Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.status}>No transactions yet.</Text>}
          />
        </>
      )}
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
  section: {
    marginTop: 16,
    fontWeight: "600",
    color: "#111827",
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  label: {
    marginTop: 8,
    color: "#6B7280",
  },
  value: {
    fontWeight: "700",
    color: "#111827",
  },
  transaction: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    marginTop: 10,
  },
  transactionTitle: {
    fontWeight: "600",
    color: "#111827",
  },
  transactionMeta: {
    marginTop: 4,
    color: "#6B7280",
  },
  transactionAmount: {
    marginTop: 6,
    color: "#111827",
    fontWeight: "700",
  },
  status: {
    color: "#6B7280",
  },
});
