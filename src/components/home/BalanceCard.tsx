import { View, StyleSheet, Pressable } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCurrencyBRL } from '../../utils/format';
import { palette, spacing, borderRadius } from '../../theme';

interface Account { 
  name: string; 
  type: string; 
  balance: number;
  icon?: string;
}

interface Props { 
  balance?: number; 
  accounts?: Account[];
  onAccountPress?: (account: Account) => void;
}

// Map account types to icons
const getAccountIcon = (type: string): string => {
  const typeMap: Record<string, string> = {
    'conta corrente': 'bank',
    'conta manual': 'wallet',
    'carteira': 'wallet',
    'poupança': 'piggy-bank',
    'investimento': 'chart-line',
    'cartão': 'credit-card',
  };
  return typeMap[type.toLowerCase()] || 'bank';
};

// Get avatar background color based on account name
const getAvatarColor = (name: string): string => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export default function BalanceCard({ balance = 0, accounts = [], onAccountPress }: Props) {
  const theme = useTheme();

  // Account item component
  const AccountRow = ({ account }: { account: Account }) => {
    const avatarColor = getAvatarColor(account.name);
    const initial = account.name.charAt(0).toUpperCase();
    
    return (
      <Pressable 
        onPress={() => onAccountPress?.(account)}
        style={({ pressed }) => [
          styles.accountRow,
          { opacity: pressed ? 0.7 : 1 }
        ]}
      >
        <View style={[styles.accountAvatar, { backgroundColor: `${avatarColor}15` }]}>
          <Text style={[styles.accountInitial, { color: avatarColor }]}>{initial}</Text>
        </View>
        
        <View style={styles.accountInfo}>
          <Text variant="bodyMedium" style={styles.accountName}>{account.name}</Text>
          <Text variant="bodySmall" style={styles.accountType}>{account.type}</Text>
        </View>
        
        <Text variant="titleSmall" style={styles.accountBalance}>
          {formatCurrencyBRL(account.balance)}
        </Text>
      </Pressable>
    );
  };

  return (
    <Card style={styles.card} mode="elevated">
      {/* Header with total balance */}
      <View style={styles.header}>
        <View style={styles.balanceSection}>
          <Text variant="labelMedium" style={styles.balanceLabel}>Saldo geral</Text>
          <Text variant="headlineMedium" style={styles.balanceValue}>
            {formatCurrencyBRL(balance)}
          </Text>
        </View>
        
        <View style={[styles.balanceIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
          <MaterialCommunityIcons 
            name="wallet-outline" 
            size={24} 
            color={theme.colors.primary} 
          />
        </View>
      </View>

      {/* Accounts section */}
      {accounts.length > 0 && (
        <>
          <View style={styles.divider} />
          
          <Text variant="labelMedium" style={styles.sectionTitle}>Minhas contas</Text>
          
          <View style={styles.accountsList}>
            {accounts.map((account, index) => (
              <AccountRow key={index} account={account} />
            ))}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceSection: {
    flex: 1,
  },
  balanceLabel: {
    color: palette.textMuted,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  balanceValue: {
    fontWeight: '700',
    color: palette.text,
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: palette.grayLight,
    marginVertical: spacing.md,
  },
  sectionTitle: {
    color: palette.textMuted,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  accountsList: {
    gap: spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInitial: {
    fontSize: 18,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  accountName: {
    fontWeight: '600',
    color: palette.text,
  },
  accountType: {
    color: palette.textMuted,
    marginTop: 2,
  },
  accountBalance: {
    fontWeight: '700',
    color: palette.text,
  },
});
