import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Loader2, TrendingUp, Mail, Eye, EyeOff } from 'lucide-react';
import api from '../api/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from '../components/ui/input-group';
import { toast } from 'sonner';

interface LoginProps {
  onLoginSuccess: (username: string, role: string, email: string, permissions: any) => void;
}

/**
 * Página de Login da Plataforma.
 * 
 * Por que existe: Permite que os analistas e administradores se autentiquem 
 * no sistema usando seu usuário e senha cadastrados no Django. Ela faz a 
 * chamada HTTP para a API de login do backend e gerencia os estados de carregamento,
 * exibindo mensagens de erro e sucesso via Toasts e organizando o formulário com o Card do Shadcn.
 */
export default function Login({ onLoginSuccess }: LoginProps) {
  const navigate = useNavigate();
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  // Por que existe: Controla a visibilidade da senha na tela de login.
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // Por que existe: Define o título da aba do navegador especificamente para a página de Login.
  useEffect(() => {
    document.title = isForgotPassword ? 'Operacional | Recuperar Senha' : 'Operacional | Login';
  }, [isForgotPassword]);

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Por favor, informe seu e-mail.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/usuarios/api/recuperar-senha/', {
        email: forgotEmail.trim(),
        origin: window.location.origin,
      });
      if (response.data.success) {
        toast.success('Se o e-mail estiver cadastrado, o link foi enviado!');
        setIsForgotPassword(false);
        setForgotEmail('');
      } else {
        toast.error(response.data.error || 'Erro ao solicitar recuperação.');
      }
    } catch (err: any) {
      console.error('Erro ao recuperar senha:', err);
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Erro de comunicação com o servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!usernameInput.trim() || !passwordInput.trim()) {
      toast.error('Por favor, preencha todos os campos.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post('/usuarios/api/login/', {
        username: usernameInput,
        password: passwordInput,
      });

      if (response.data.success) {
        onLoginSuccess(
          response.data.user.username,
          response.data.user.role,
          response.data.user.email || '',
          response.data.user.permissions || {}
        );
        toast.success(`Bem-vindo, ${response.data.user.username}!`);
        navigate('/');
      } else {
        toast.error(response.data.error || 'Erro desconhecido ao autenticar.');
      }
    } catch (err: any) {
      console.error('Erro na requisição de login:', err);
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs mb-4">
          <TrendingUp className="h-6 w-6" />
        </div>
        <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
          Sistema Operacional
        </h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-450">
          Entre com as suas credenciais
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="w-full bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-neutral-900 dark:text-white">
              {isForgotPassword ? 'Recuperar Senha' : 'Acesse sua conta'}
            </CardTitle>
            <CardDescription className="text-xs text-neutral-400">
              {isForgotPassword ? 'Enviaremos um link de recuperação para seu e-mail' : 'Preencha as informações abaixo'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {isForgotPassword ? (
              <form className="space-y-6" onSubmit={handleForgotPasswordSubmit}>
                <div>
                  <label htmlFor="forgotEmail" className="block text-xs font-semibold text-neutral-400 dark:text-neutral-450 uppercase tracking-wider mb-1.5">
                    E-mail de Cadastro
                  </label>
                  <InputGroup className="w-full">
                    <InputGroupAddon align="inline-start">
                      <Mail className="h-4 w-4 text-neutral-450" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="forgotEmail"
                      name="forgotEmail"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Seu e-mail cadastrado"
                      disabled={isLoading}
                    />
                  </InputGroup>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-full text-xs font-bold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-850 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar E-mail de Recuperação'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setForgotEmail('');
                    }}
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Voltar para o Login
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="username" className="block text-xs font-semibold text-neutral-400 dark:text-neutral-450 uppercase tracking-wider mb-1.5">
                    Usuário
                  </label>
                  <InputGroup className="w-full">
                    <InputGroupAddon align="inline-start">
                      <User className="h-4 w-4 text-neutral-450" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="username"
                      name="username"
                      type="text"
                      required
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Seu usuário"
                      disabled={isLoading}
                    />
                  </InputGroup>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="password" className="block text-xs font-semibold text-neutral-400 dark:text-neutral-450 uppercase tracking-wider">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <InputGroup className="w-full">
                    <InputGroupAddon align="inline-start">
                      <Lock className="h-4 w-4 text-neutral-450" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Sua senha"
                      disabled={isLoading}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="text-neutral-450 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-full text-xs font-bold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-850 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Autenticando...
                      </>
                    ) : (
                      'Entrar no Sistema'
                    )}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
