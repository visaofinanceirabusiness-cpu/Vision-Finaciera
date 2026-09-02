'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const COLORES = {
  azul: '#1f3a5f',
  verde: '#2e8b57',
  gris: '#6e7781',
  blanco: '#ffffff',
  fondo: '#f5f7f9',
};

type Empresa = {
  nombre: string;
  idioma: string;
};

type Mensagem = {
  id: number;
  assuntoPT: string;
  assuntoES: string;
  textoPT: string;
  textoES: string;
};

const MENSAGENS_ENCANTO: Mensagem[] = [
  {
    id: 1,

    assuntoPT: 'Vamos olhar para o seu resultado',

    assuntoES: 'Vamos mirar tu resultado',

    textoPT: `Olá, Brenda! 👋

Estive analisando os números da Encanto e quero chamar sua atenção para uma coisa importante.

Até o momento, seu negócio apresenta um resultado acumulado de R$ 771, sobre uma receita operacional de R$ 2.303.

Isso significa que, depois dos custos das mercadorias e das despesas registradas, aproximadamente R$ 33,50 de cada R$ 100 vendidos permanecem como resultado.

É um indicador positivo, mas existe um ponto que precisamos observar juntos.

O resultado não está crescendo de forma constante. Nos últimos meses tivemos uma recuperação importante, mas setembro apresentou resultado negativo de R$ 120.

Isso não significa, sozinho, que o negócio esteja indo mal.

Significa que precisamos entender o que aconteceu neste mês.

Pode estar relacionado ao volume de vendas, ao custo das mercadorias, às despesas ou a algum movimento extraordinário.

💡 Minha recomendação: antes de aumentar compras ou assumir novos compromissos, vamos entender o que provocou essa mudança no resultado de setembro.

Os números estão dizendo que a Encanto tem capacidade de gerar resultado, mas precisamos acompanhar mais de perto a evolução mensal.

Abraço,

Sabio 🦉
Visão Financeira
Clareza para decidir. Segurança para crescer.`,

    textoES: `Hola, Brenda! 👋

Estuve analizando los números de Encanto y quiero llamar tu atención sobre algo importante.

Hasta el momento, tu negocio presenta un resultado acumulado de R$ 771, sobre una facturación operativa de R$ 2.303.

Eso significa que, después de los costos de las mercaderías y los gastos registrados, aproximadamente R$ 33,50 de cada R$ 100 vendidos permanecen como resultado.

Es un indicador positivo, pero hay un punto que debemos observar juntos.

El resultado no está creciendo de manera constante. En los últimos meses tuvimos una recuperación importante, pero septiembre presentó un resultado negativo de R$ 120.

Esto no significa, por sí solo, que el negocio esté funcionando mal.

Significa que necesitamos entender qué ocurrió este mes.

Puede estar relacionado con el volumen de ventas, el costo de las mercaderías, los gastos o algún movimiento extraordinario.

💡 Mi recomendación: antes de aumentar las compras o asumir nuevos compromisos, debemos entender qué provocó este cambio en el resultado de septiembre.

Los números indican que Encanto tiene capacidad para generar resultados, pero necesitamos acompañar más de cerca su evolución mensual.

Un abrazo,

Sabio 🦉
Visão Financeira
Claridad para decidir. Seguridad para crecer.`,
  },

  {
    id: 2,

    assuntoPT: 'Onde está o dinheiro da Encanto?',

    assuntoES: '¿Dónde está el dinero de Encanto?',

    textoPT: `Olá, Brenda! 👋

Hoje quero olhar para outro ponto importante: a estrutura financeira da Encanto.

Atualmente, você possui R$ 671 disponíveis em caixa e não possui passivos registrados.

Isso é uma situação positiva.

Significa que, dentro das informações registradas no sistema, a empresa não está dependendo de dívidas para manter sua estrutura financeira atual.

Mas existe uma coisa importante para entender:

ter dinheiro em caixa não significa necessariamente que esse dinheiro esteja disponível para gastar.

Parte dos recursos da empresa está aplicada no estoque.

Hoje, o estoque representa aproximadamente R$ 280.

Ou seja, uma parte do patrimônio da Encanto está transformada em produtos que ainda precisam ser vendidos para voltar ao caixa.

💡 O que isso significa?

Antes de utilizar todo o caixa para comprar novos produtos, precisamos observar quanto do estoque atual está realmente girando.

O objetivo não é simplesmente ter mais produtos.

O objetivo é fazer o capital da empresa circular e gerar retorno.

Por enquanto, sua estrutura financeira apresenta uma boa característica: caixa disponível e ausência de passivos registrados.

Agora precisamos trabalhar para que esse capital seja utilizado da maneira mais eficiente possível.

Abraço,

Sabio 🦉
Visão Financeira
Clareza para decidir. Segurança para crescer.`,

    textoES: `Hola, Brenda! 👋

Hoy quiero mirar otro punto importante: la estructura financiera de Encanto.

Actualmente tienes R$ 671 disponibles en caja y no tienes pasivos registrados.

Esto es una situación positiva.

Significa que, dentro de la información registrada en el sistema, la empresa no depende de deudas para mantener su estructura financiera actual.

Pero hay algo importante que entender:

tener dinero en caja no significa necesariamente que ese dinero esté disponible para gastar.

Parte de los recursos de la empresa está aplicada al stock.

Actualmente, el stock representa aproximadamente R$ 280.

Es decir, una parte del patrimonio de Encanto está transformada en productos que todavía deben venderse para volver a convertirse en caja.

💡 ¿Qué significa esto?

Antes de utilizar toda la caja para comprar nuevos productos, debemos observar cuánto del stock actual realmente está girando.

El objetivo no es simplemente tener más productos.

El objetivo es hacer que el capital de la empresa circule y genere retorno.

Por ahora, tu estructura financiera presenta una característica positiva: caja disponible y ausencia de pasivos registrados.

Ahora necesitamos trabajar para que ese capital sea utilizado de la manera más eficiente posible.

Un abrazo,

Sabio 🦉
Visão Financeira
Claridad para decidir. Seguridad para crecer.`,
  },

  {
    id: 3,

    assuntoPT: 'Vamos prestar atenção ao seu estoque',

    assuntoES: 'Vamos prestar atención a tu stock',

    textoPT: `Olá, Brenda! 👋

Tem uma informação dos seus números que merece nossa atenção especial.

A Encanto movimentou R$ 2.303 em vendas, enquanto o custo das mercadorias vendidas foi de R$ 1.308.

Isso significa que uma parcela importante da receita está sendo utilizada para repor o custo dos produtos vendidos.

Até aqui, isso é normal para uma empresa comercial.

O ponto interessante está em como o dinheiro está distribuído entre as categorias.

Os produtos de beleza representam a maior parte das vendas, com R$ 1.683.

Ao mesmo tempo, acessórios possuem uma participação muito relevante no estoque atual.

💡 Isso nos leva a uma pergunta importante:

Estamos colocando mais dinheiro em estoque justamente nos produtos que mais giram?

Essa é uma pergunta financeira, não apenas comercial.

Um produto pode ter uma boa margem e ainda assim não ser uma boa aplicação de capital se permanecer muito tempo parado.

Por isso, para as próximas compras, minha sugestão é observar três coisas:

margem + giro + capital investido.

Não precisamos simplesmente vender mais.

Precisamos fazer com que cada real investido em estoque tenha capacidade de retornar para a empresa e gerar novo resultado.

Esse será um dos pontos que vale acompanhar nos próximos meses.

Abraço,

Sabio 🦉
Visão Financeira
Clareza para decidir. Segurança para crescer.`,

    textoES: `Hola, Brenda! 👋

Hay una información de tus números que merece nuestra atención especial.

Encanto generó R$ 2.303 en ventas, mientras que el costo de las mercaderías vendidas fue de R$ 1.308.

Esto significa que una parte importante de los ingresos está siendo utilizada para cubrir el costo de los productos vendidos.

Hasta aquí, esto es normal para una empresa comercial.

Lo interesante está en cómo está distribuido el dinero entre las categorías.

Los productos de belleza representan la mayor parte de las ventas, con R$ 1.683.

Al mismo tiempo, los accesorios tienen una participación muy importante en el stock actual.

💡 Esto nos lleva a una pregunta importante:

¿Estamos colocando más dinero en stock justamente en los productos que más rotan?

Esta es una pregunta financiera, no solamente comercial.

Un producto puede tener un buen margen y aun así no ser una buena aplicación de capital si permanece demasiado tiempo inmovilizado.

Por eso, para las próximas compras, mi sugerencia es observar tres cosas:

margen + rotación + capital invertido.

No necesitamos simplemente vender más.

Necesitamos conseguir que cada real invertido en stock tenga capacidad de regresar a la empresa y generar un nuevo resultado.

Este será uno de los puntos que vale la pena acompañar durante los próximos meses.

Un abrazo,

Sabio 🦉
Visão Financeira
Claridad para decidir. Seguridad para crecer.`,
  },
];

export default function MensajesPage() {
  const router = useRouter();

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarEmpresa() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push('/login');
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('empresa_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!perfil?.empresa_id) {
        router.push('/inicio');
        return;
      }

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nombre, idioma')
        .eq('id', perfil.empresa_id)
        .maybeSingle();

      setEmpresa(empresaData);
      setCargando(false);
    }

    cargarEmpresa();
  }, [router]);

  if (cargando) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORES.fondo,
          color: COLORES.azul,
          fontWeight: 700,
        }}
      >
        Cargando mensajes...
      </main>
    );
  }

  const idioma = empresa?.idioma === 'PT' ? 'PT' : 'ES';
  const mensajes = MENSAGENS_ENCANTO;

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #edf4f1 0%, transparent 34%), #f5f7f9',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        <button
          onClick={() => router.push('/inicio')}
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORES.azul,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '8px 0',
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          ← {idioma === 'PT' ? 'Voltar ao início' : 'Volver al inicio'}
        </button>

        <section
          style={{
            background: COLORES.blanco,
            borderRadius: 24,
            border: '1px solid #e5e7eb',
            padding: 30,
            marginBottom: 20,
            boxShadow: '0 12px 30px rgba(31,58,95,0.06)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.4,
              color: COLORES.verde,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Visão Financeira
          </div>

          <h1
            style={{
              margin: 0,
              color: COLORES.azul,
              fontSize: 28,
            }}
          >
            {idioma === 'PT'
              ? 'Mensagens sobre o seu negócio'
              : 'Mensajes sobre tu negocio'}
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              color: COLORES.gris,
              lineHeight: 1.6,
            }}
          >
            {idioma === 'PT'
              ? 'Sabio analisou seus números e separou alguns pontos importantes para você.'
              : 'Sabio analizó tus números y separó algunos puntos importantes para ti.'}
          </p>
        </section>

        <div style={{ display: 'grid', gap: 12 }}>
          {mensajes.map((mensagem, index) => {
            const isOpen = aberto === mensagem.id;

            return (
              <section
                key={mensagem.id}
                style={{
                  background: COLORES.blanco,
                  borderRadius: 18,
                  border: isOpen
                    ? `1px solid ${COLORES.verde}`
                    : '1px solid #e5e7eb',
                  overflow: 'hidden',
                  boxShadow: isOpen
                    ? '0 10px 25px rgba(46,139,87,0.08)'
                    : '0 5px 15px rgba(31,58,95,0.04)',
                }}
              >
                <button
                  onClick={() =>
                    setAbierto(isOpen ? null : mensagem.id)
                  }
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '20px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: `${COLORES.verde}12`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    ✉️
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: COLORES.verde,
                        marginBottom: 4,
                      }}
                    >
                      {idioma === 'PT'
                        ? `MENSAGEM ${index + 1}`
                        : `MENSAJE ${index + 1}`}
                    </div>

                    <div
                      style={{
                        color: COLORES.azul,
                        fontSize: 17,
                        fontWeight: 800,
                      }}
                    >
                      {idioma === 'PT'
                        ? mensagem.assuntoPT
                        : mensagem.assuntoES}
                    </div>
                  </div>

                  <div
                    style={{
                      color: COLORES.azul,
                      fontSize: 20,
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                   ⌄
                  </div>
                </button>

                {isOpen && (
                  <div
                    style={{
                      borderTop: '1px solid #edf0f2',
                      padding: '24px 28px 28px',
                      color: '#374151',
                      fontSize: 15,
                      lineHeight: 1.75,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {idioma === 'PT'
                      ? mensagem.textoPT
                      : mensagem.textoES}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div
          style={{
            textAlign: 'center',
            marginTop: 28,
            color: COLORES.gris,
            fontSize: 12,
          }}
        >
          🦉 {idioma === 'PT'
            ? 'Sabio estará aqui sempre que você quiser entender melhor seus números.'
            : 'Sabio estará aquí cuando quieras entender mejor tus números.'}
        </div>
      </div>
    </main>
  );
}
