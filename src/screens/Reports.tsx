import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Card from '../components/Card';
import { palette } from '../theme';
import AppHeader from '../components/AppHeader';
import MainLayout from '../components/MainLayout';

export default function Reports() {
  return (
    <MainLayout>
      <ScrollView style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 18 }}>
        <AppHeader />
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <View style={{ width: '100%', maxWidth: 980, paddingHorizontal: 12 }}>
            <Card>
              <Text style={styles.title}>Relatórios</Text>
              <View style={{ height: 8 }} />
              <Text style={{ color: palette.muted }}>Visualize relatórios com os gastos e entradas do mês atual e anteriores.</Text>
            </Card>
          </View>
        </View>
      </ScrollView>
    </MainLayout>
  );
}

const styles = StyleSheet.create({ title: { fontSize: 20, fontWeight: '700' } });
