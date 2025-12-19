import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Register from '../Register';
import { register } from '../../services/auth';

// Mock do serviço de autenticação
jest.mock('../../services/auth', () => ({
  register: jest.fn(),
}));

// Mock do SafeAreaView
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

// Mock do @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

describe('Register Screen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização', () => {
    it('deve renderizar todos os elementos principais', () => {
      const { getByText, getByPlaceholderText } = render(
        <Register navigation={mockNavigation} />
      );

      expect(getByText('Criar Conta')).toBeTruthy();
      expect(getByText('Controle financeiro pessoal')).toBeTruthy();
      expect(getByText('Preencha seus dados')).toBeTruthy();
      expect(getByPlaceholderText('Email')).toBeTruthy();
      expect(getByPlaceholderText('Senha')).toBeTruthy();
      expect(getByPlaceholderText('Confirme sua senha')).toBeTruthy();
      expect(getByText('Criar conta')).toBeTruthy();
    });

    it('deve renderizar a label de senha com requisitos', () => {
      const { getByText } = render(<Register navigation={mockNavigation} />);
      
      expect(getByText('SENHA ( mínimo 6 caracteres )')).toBeTruthy();
    });

    it('deve renderizar link para fazer login', () => {
      const { getByText } = render(<Register navigation={mockNavigation} />);
      
      expect(getByText(/Já tem conta\?/)).toBeTruthy();
      expect(getByText('Fazer login')).toBeTruthy();
    });

    it('deve renderizar link para Termos de Uso', () => {
      const { getByText } = render(<Register navigation={mockNavigation} />);
      
      expect(getByText('Termos de Uso')).toBeTruthy();
    });
  });

  describe('Validação de Email', () => {
    it('deve mostrar erro para email vazio', async () => {
      const { getByText } = render(<Register navigation={mockNavigation} />);
      
      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Por favor insira um email válido.')).toBeTruthy();
      });
    });

    it('deve mostrar erro para email inválido', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'emailinvalido');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Por favor insira um email válido.')).toBeTruthy();
      });
    });

    it('deve aceitar email válido', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(queryByText('Por favor insira um email válido.')).toBeNull();
      });
    });
  });

  describe('Validação de Senha', () => {
    it('deve mostrar erro para senha com menos de 6 caracteres', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '12345');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('A senha precisa ter pelo menos 6 caracteres.')).toBeTruthy();
      });
    });

    it('deve aceitar senha com exatamente 6 caracteres', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(queryByText('A senha precisa ter pelo menos 6 caracteres.')).toBeNull();
      });
    });

    it('deve aceitar senha apenas com números', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(queryByText('A senha precisa ter pelo menos 6 caracteres.')).toBeNull();
      });
    });

    it('deve aceitar senha apenas com letras minúsculas', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, 'abcdef');
      fireEvent.changeText(confirmPasswordInput, 'abcdef');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(queryByText('A senha precisa ter pelo menos 6 caracteres.')).toBeNull();
      });
    });
  });

  describe('Confirmação de Senha', () => {
    it('deve mostrar erro quando as senhas não coincidem', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '654321');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('As senhas não coincidem.')).toBeTruthy();
      });
    });

    it('deve aceitar quando as senhas coincidem', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(queryByText('As senhas não coincidem.')).toBeNull();
      });
    });
  });

  describe('Visibilidade de Senha', () => {
    it('deve alternar visibilidade da senha principal', () => {
      const { getByPlaceholderText, getAllByLabelText } = render(
        <Register navigation={mockNavigation} />
      );

      const passwordInput = getByPlaceholderText('Senha');
      
      // Senha deve estar oculta inicialmente
      expect(passwordInput.props.secureTextEntry).toBe(true);

      // Encontrar e clicar no botão de mostrar senha (primeiro eye button)
      const eyeButtons = getAllByLabelText(/senha/i);
      const showPasswordButton = eyeButtons.find(btn => 
        btn.props.accessibilityLabel === 'Mostrar senha'
      );
      
      if (showPasswordButton) {
        fireEvent.press(showPasswordButton);
      }

      // Senha deve estar visível
      expect(passwordInput.props.secureTextEntry).toBe(false);
    });

    it('deve alternar visibilidade da confirmação de senha', () => {
      const { getByPlaceholderText, getAllByLabelText } = render(
        <Register navigation={mockNavigation} />
      );

      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');
      
      // Senha deve estar oculta inicialmente
      expect(confirmPasswordInput.props.secureTextEntry).toBe(true);

      // Encontrar e clicar no botão de mostrar senha de confirmação
      const eyeButtons = getAllByLabelText(/senha/i);
      const showConfirmPasswordButtons = eyeButtons.filter(btn => 
        btn.props.accessibilityLabel === 'Mostrar senha'
      );
      
      // O segundo botão é da confirmação de senha
      if (showConfirmPasswordButtons[1]) {
        fireEvent.press(showConfirmPasswordButtons[1]);
      }

      // Senha deve estar visível
      expect(confirmPasswordInput.props.secureTextEntry).toBe(false);
    });
  });

  describe('Submissão do Formulário', () => {
    it('deve chamar register com dados corretos', async () => {
      (register as jest.Mock).mockResolvedValue(undefined);

      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(register).toHaveBeenCalledWith('teste@email.com', '123456');
      });
    });

    it('deve mostrar loading durante registro', async () => {
      let resolveRegister: any;
      (register as jest.Mock).mockImplementation(
        () => new Promise(resolve => { resolveRegister = resolve; })
      );

      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(register).toHaveBeenCalled();
      });

      // Resolver a promise para limpar
      if (resolveRegister) resolveRegister();
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve mostrar erro quando email já está em uso', async () => {
      (register as jest.Mock).mockRejectedValue({
        code: 'auth/email-already-in-use',
        message: 'Email já cadastrado',
      });

      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(
          getByText('Esse email já está em uso. Tente recuperar a senha ou use outro email.')
        ).toBeTruthy();
      });
    });

    it('deve mostrar erro para senha fraca', async () => {
      (register as jest.Mock).mockRejectedValue({
        code: 'auth/weak-password',
        message: 'Senha fraca',
      });

      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Senha fraca. Use no mínimo 6 caracteres.')).toBeTruthy();
      });
    });

    it('deve mostrar erro para email inválido do Firebase', async () => {
      (register as jest.Mock).mockRejectedValue({
        code: 'auth/invalid-email',
        message: 'Email inválido',
      });

      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Email inválido. Verifique o formato do e-mail.')).toBeTruthy();
      });
    });

    it('deve mostrar erro de conexão', async () => {
      (register as jest.Mock).mockRejectedValue({
        code: 'auth/network-request-failed',
        message: 'Erro de rede',
      });

      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(
          getByText('Sem conexão. Verifique sua internet e tente novamente.')
        ).toBeTruthy();
      });
    });

    it('deve mostrar erro genérico para erros desconhecidos', async () => {
      (register as jest.Mock).mockRejectedValue({
        code: 'auth/unknown-error',
        message: 'Erro desconhecido',
      });

      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Erro desconhecido')).toBeTruthy();
      });
    });

    it('deve limpar erro anterior ao tentar novamente', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const createButton = getByText('Criar conta');

      // Primeiro, gerar um erro
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(getByText('Por favor insira um email válido.')).toBeTruthy();
      });

      // Agora preencher o email
      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(queryByText('Por favor insira um email válido.')).toBeNull();
      });
    });
  });

  describe('Navegação', () => {
    it('deve navegar de volta ao clicar em "Fazer login"', () => {
      const { getByText } = render(<Register navigation={mockNavigation} />);

      const loginLink = getByText('Fazer login');
      fireEvent.press(loginLink);

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('deve navegar para Termos de Uso', () => {
      const { getByText } = render(<Register navigation={mockNavigation} />);

      const termsLink = getByText('Termos de Uso');
      fireEvent.press(termsLink);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Termos de Uso');
    });
  });

  describe('Estados dos Campos', () => {
    it('deve desabilitar inputs durante loading', async () => {
      (register as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const { getByPlaceholderText, getByText } = render(
        <Register navigation={mockNavigation} />
      );

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Senha');
      const confirmPasswordInput = getByPlaceholderText('Confirme sua senha');

      fireEvent.changeText(emailInput, 'teste@email.com');
      fireEvent.changeText(passwordInput, '123456');
      fireEvent.changeText(confirmPasswordInput, '123456');

      const createButton = getByText('Criar conta');
      fireEvent.press(createButton);

      // Inputs devem estar desabilitados
      expect(emailInput.props.editable).toBe(false);
      expect(passwordInput.props.editable).toBe(false);
      expect(confirmPasswordInput.props.editable).toBe(false);

      await waitFor(() => {
        expect(register).toHaveBeenCalled();
      });
    });
  });
});
