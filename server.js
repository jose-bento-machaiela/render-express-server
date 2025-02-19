
// import express from 'express';
// import mysql from 'mysql2';
// import bodyParser from 'body-parser';
// import cors from 'cors';
// import request from 'request';

// const app = express();
// app.use(cors());
// app.use(bodyParser.json());

// // Configuração da conexão MySQL
// const db = mysql.createConnection({
//   host: 'nudata.digital',
//   user: 'u730982402_nudata',
//   password: 'jKXXxu+2O',
//   database: 'u730982402_nudata_data',
//   connectionLimit: 10, // Limite de conexões simultâneas
//   connectTimeout: 10000,  // Tempo máximo de espera para se conectar (10 segundos)
//   acquireTimeout: 10000,  // Tempo máximo de espera para obter uma conexão (10 segundos)
// });

// // Rota para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   const { name, phone, email, city, jobAreas } = req.body;

//   const startDate = new Date();
//   const endDate = new Date();
//   endDate.setDate(startDate.getDate() + 30);  // A subscrição vai até 30 dias depois

//   const subscription = {
//     name,
//     phone,
//     email,
//     city,
//     job_areas: JSON.stringify(jobAreas),
//     start_date: startDate.toISOString().split('T')[0],
//     end_date: endDate.toISOString().split('T')[0],
//     payment_status: 'pending'
//   };

//   // Inserir a subscrição no banco de dados
//   db.query('INSERT INTO subscriptions SET ?', subscription, (err, result) => {
//     if (err) return res.status(500).send(err);

//     // Após inserir a subscrição, enviar o SMS de boas-vindas
//     sendSMS(name, phone, endDate);

//     // Redirecionar para o MozPay
//     const paymentUrl = `https://mozpayment.com/pay?amount=49&reference=${result.insertId}`;
//     res.json({ paymentUrl });
//   });
// });

// // Função para enviar SMS
// const sendSMS = (name, phone, endDate) => {
//   const token = '2330:M7KqQf-CXWbDL-F3RVP0-TmJC9B'; // Seu token de autorização
//   const senderID = 'ESHOP'; // Sender ID (nome que aparecerá no SMS)

//   // Mensagem personalizada com o nome e data de término da subscrição
//   const message = `Olá ${name}. Seja Bem-Vindo(a) à Workar! A partir de hoje receberá notificações de Vagas de Emprego e Oportunidades de Carreira e Negócios por SMS. A tua subscrição está activa até ${endDate.toLocaleDateString("pt-MZ", {day: "numeric", month: "long", year: "numeric", })}. Workar - O Sucesso Começa Agora!`; 

//   var options = {
//     method: 'POST',
//     url: 'https://api.mozesms.com/message/v2',
//     headers: {
//       'Authorization': `Bearer ${token}`, // Token de autorização
//     },
//     form: {
//       'from': senderID, // Sender ID
//       'to': `+258${phone}`, // Número de telefone do destinatário com código de país (+258)
//       'message': message, // Mensagem
//     },
//   };

//   // Envio do SMS usando o request
//   request(options, function (error, response) {
//     if (error) {
//       console.error('Erro ao enviar SMS:', error);
//     } else {
//       console.log('SMS enviado com sucesso:', response.body);
//     }
//   });
// };

// // Webhook para confirmação de pagamento
// app.post('/api/payment-webhook', (req, res) => {
//   const { reference, status } = req.body;

//   if (status === 'success') {
//     db.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?',
//       ['completed', reference], (err) => {
//         if (err) console.error(err);
//       });
//   }

//   res.sendStatus(200);
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


















// import express from 'express';
// import mysql from 'mysql2';
// import bodyParser from 'body-parser';
// import cors from 'cors';
// import axios from 'axios'; // Substituindo 'request' por 'axios'

// const app = express();
// app.use(cors());
// app.use(bodyParser.json());

// // Configuração do pool de conexões MySQL
// const db = mysql.createPool({
//   host: 'nudata.digital',
//   user: 'u730982402_nudata',
//   password: 'jKXXxu+2O',
//   database: 'u730982402_nudata_data',
//   connectionLimit: 10, // Tamanho do pool de conexões
// });

// // Função para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   const { name, phone, email, city, jobAreas } = req.body;

//   const startDate = new Date();
//   const endDate = new Date();
//   endDate.setDate(startDate.getDate() + 30);  // A subscrição vai até 30 dias depois

//   const subscription = {
//     name,
//     phone,
//     email,
//     city,
//     job_areas: JSON.stringify(jobAreas),
//     start_date: startDate.toISOString().split('T')[0],
//     end_date: endDate.toISOString().split('T')[0],
//     payment_status: 'pending',
//   };

//   try {
//     const result = await new Promise((resolve, reject) => {
//       db.query('INSERT INTO subscriptions SET ?', subscription, (err, result) => {
//         if (err) reject(err);
//         resolve(result);
//       });
//     });

//     // Após inserir a subscrição, enviar o SMS de boas-vindas
//     // sendSMS(name, phone, endDate);

//     // Redirecionar para o MozPay
//     const paymentUrl = `https://mozpayment.com/pay?amount=49&reference=${result.insertId}`;
//     res.json({ paymentUrl });

//   } catch (err) {
//     res.status(500).send(err);
//   }
// });

// // Função para enviar SMS (usando 'axios' em vez de 'request')
// const sendSMS = (name, phone, endDate) => {
//   const token = process.env.SMS_TOKEN; // Usando variáveis de ambiente para segurança
//   const senderID = 'ESHOP'; // Sender ID (nome que aparecerá no SMS)

//   // Mensagem personalizada com o nome e data de término da subscrição
//   const message = `Olá ${name}. Seja Bem-Vindo(a) à Workar! A partir de hoje receberá notificações de Vagas de Emprego e Oportunidades de Carreira e Negócios por SMS. A tua subscrição está activa até ${endDate.toLocaleDateString("pt-MZ", { day: "numeric", month: "long", year: "numeric" })}. Workar - O Sucesso Começa Agora!`;

//   axios.post('https://api.mozesms.com/message/v2', {
//     from: senderID,
//     to: `+258${phone}`,
//     message: message,
//   }, {
//     headers: {
//       'Authorization': `Bearer ${token}`,
//     },
//   })
//   .then(response => {
//     console.log('SMS enviado com sucesso:', response.data);
//   })
//   .catch(error => {
//     console.error('Erro ao enviar SMS:', error);
//   });
// };

// // Webhook para confirmação de pagamento
// app.post('/api/payment-webhook', (req, res) => {
//   const { reference, status } = req.body;

//   if (status === 'success') {
//     db.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?',
//       ['completed', reference], (err) => {
//         if (err) {
//           console.error('Erro ao atualizar o status do pagamento:', err);
//           return res.status(500).send('Erro ao processar pagamento');
//         }
//         res.sendStatus(200);
//       });
//   } else {
//     console.log('Pagamento não aprovado ou inválido.');
//     res.sendStatus(400); // Retornar erro se o status não for 'success'
//   }
// });

// // Iniciar o servidor
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
























// import express from 'express';
// import mysql from 'mysql2';
// import bodyParser from 'body-parser';
// import cors from 'cors';
// import axios from 'axios'; // Substituindo 'request' por 'axios'

// const app = express();
// // app.use(cors());

// app.use(cors({
//   origin: 'http://localhost:5173'
// }));

// // app.use((req, res, next) => {
// //   res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); // Permite o acesso do seu frontend
// //   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE'); // Métodos permitidos
// //   res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Cabeçalhos permitidos
// //   next();
// // });


// app.use(bodyParser.json());

// // Configuração do pool de conexões MySQL
// const db = mysql.createPool({
//   host: 'nudata.digital', //
//   user: 'u730982402_nudata',
//   password: 'jKXXxu+2O',
//   database: 'u730982402_nudata_data',
//   connectionLimit: 10, // Tamanho do pool de conexões
// });

// // Função para verificar a conexão e criar a tabela 'conectacaosucesso'
// const checkConnection = () => {
//   db.getConnection((err, connection) => {
//     if (err) {
//       console.error('Erro ao conectar ao banco de dados:', err);
//       return;
//     }

//     console.log('Conectado ao banco de dados com sucesso!');

//     // Criar a tabela 'conectacaosucesso' se ela não existir
//     const createTableQuery = `
//       CREATE TABLE IF NOT EXISTS conectacaosucesso (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         message VARCHAR(255) NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `;

//     connection.query(createTableQuery, (err, result) => {
//       if (err) {
//         console.error('Erro ao criar a tabela:', err);
//         return;
//       }

//       console.log('Tabela "conectacaosucesso" criada com sucesso na nuvem!');

//       // Inserir uma mensagem de sucesso na tabela
//       const insertMessageQuery = `
//         INSERT INTO conectacaosucesso (message)
//         VALUES ('Conexão bem-sucedida com o banco de dados')
//       `;
//       connection.query(insertMessageQuery, (err, result) => {
//         if (err) {
//           console.error('Erro ao inserir mensagem na tabela:', err);
//           return;
//         }

//         console.log('Mensagem de sucesso inserida na tabela "conectacaosucesso"');
//       });
//     });

//     connection.release();
//   });
// };

// // Verificar a conexão ao iniciar o servidor
// checkConnection();

// // Função para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   console.log('Fazendo post');
//   const { name, phone, email, city, jobAreas } = req.body;

//   const startDate = new Date();
//   const endDate = new Date();
//   endDate.setDate(startDate.getDate() + 30);  // A subscrição vai até 30 dias depois

//   const subscription = {
//     name,
//     phone,
//     email,
//     city,
//     job_areas: JSON.stringify(jobAreas),
//     start_date: startDate.toISOString().split('T')[0],
//     end_date: endDate.toISOString().split('T')[0],
//     payment_status: 'pending',
//   };
//   console.log(subscription);

//   try {
//     const result = await new Promise((resolve, reject) => {
//       console.log('TENTANDO CONECTAR');
//       db.query('INSERT INTO subscriptions SET ?', subscription, (err, result) => {
//         if (err) reject(err);
//         console.log(err)
//         resolve(result);
//       });
//     });

//     // Após inserir a subscrição, enviar o SMS de boas-vindas
//     // sendSMS(name, phone, endDate);

//     // Redirecionar para o MozPay
//     const paymentUrl = `https://mozpayment.com/pay?amount=49&reference=${result.insertId}`;
//     res.json({ paymentUrl });

//   } catch (err) {
//     res.status(500).send(err);
//   }
// });

// // Função para enviar SMS (usando 'axios' em vez de 'request')
// const sendSMS = (name, phone, endDate) => {
//   const token = '2330:M7KqQf-CXWbDL-F3RVP0-TmJC9B'; // Usando variáveis de ambiente para segurança
//   const senderID = 'ESHOP'; // Sender ID (nome que aparecerá no SMS)

//   // Mensagem personalizada com o nome e data de término da subscrição
//   const message = `Olá ${name}. Seja Bem-Vindo(a) à Workar! A partir de hoje receberá notificações de Vagas de Emprego e Oportunidades de Carreira e Negócios por SMS. A tua subscrição está activa até ${endDate.toLocaleDateString("pt-MZ", { day: "numeric", month: "long", year: "numeric" })}. Workar - O Sucesso Começa Agora!`;

//   axios.post('https://api.mozesms.com/message/v2', {
//     from: senderID,
//     to: `+258${phone}`,
//     message: message,
//   }, {
//     headers: {
//       'Authorization': `Bearer ${token}`,
//     },
//   })
//   .then(response => {
//     console.log('SMS enviado com sucesso:', response.data);
//   })
//   .catch(error => {
//     console.error('Erro ao enviar SMS:', error);
//   });
// };

// // Webhook para confirmação de pagamento
// app.post('/api/payment-webhook', (req, res) => {
//   const { reference, status } = req.body;

//   if (status === 'success') {
//     db.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?',
//       ['completed', reference], (err) => {
//         if (err) {
//           console.error('Erro ao atualizar o status do pagamento:', err);
//           return res.status(500).send('Erro ao processar pagamento');
//         }
//         res.sendStatus(200);
//       });
//   } else {
//     console.log('Pagamento não aprovado ou inválido.');
//     res.sendStatus(400); // Retornar erro se o status não for 'success'
//   }
// });

// // Iniciar o servidor
// const PORT = 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));





















import express from 'express';
import mysql from 'mysql2';
import bodyParser from 'body-parser';
import cors from 'cors';
import axios from 'axios'; // Substituindo 'request' por 'axios'
import path from 'path'; // Usado para resolver o caminho do arquivo

import dotenv from 'dotenv';
dotenv.config();

const app = express();


// Habilitar CORS (apenas para desenvolvimento, para produção, altere o origin)
app.use(cors({
  // origin: 'http://localhost:5173' // Modifique isso para o seu domínio de produção
}));

app.use(bodyParser.json());

// Configuração do pool de conexões MySQL
const db = mysql.createPool({
  host: 'nudata.digital', //
  user: 'u730982402_nudata', //
  password: 'jKXXxu+2O', //
  database: 'u730982402_nudata_data', //
  connectionLimit: 10,
});

// Função para verificar a conexão e criar a tabela 'conectacaosucesso'
const checkConnection = () => {
  db.getConnection((err, connection) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados:', err);
      return;
    }

    console.log('Conectado ao banco de dados com sucesso!');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS conectacaosucesso (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    connection.query(createTableQuery, (err, result) => {
      if (err) {
        console.error('Erro ao criar a tabela:', err);
        return;
      }

      console.log('Tabela "conectacaosucesso" criada com sucesso na nuvem!');

      const insertMessageQuery = `
        INSERT INTO conectacaosucesso (message)
        VALUES ('Conexão bem-sucedida com o banco de dados')
      `;
      connection.query(insertMessageQuery, (err, result) => {
        if (err) {
          console.error('Erro ao inserir mensagem na tabela:', err);
          return;
        }

        console.log('Mensagem de sucesso inserida na tabela "conectacaosucesso"');
      });
    });

    connection.release();
  });
};

checkConnection();

// Função para criar uma subscrição
app.post('/api/subscriptions', async (req, res) => {
  console.log('Fazendo post');
  const { name, phone, email, city, jobAreas } = req.body;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + 30);

  const subscription = {
    name,
    phone,
    email,
    city,
    job_areas: JSON.stringify(jobAreas),
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    payment_status: 'pending',
  };

  try {
    const result = await new Promise((resolve, reject) => {
      db.query('INSERT INTO subscriptions SET ?', subscription, (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });

    const paymentUrl = `https://mozpayment.com/pay?amount=49&reference=${result.insertId}`;
    res.json({ paymentUrl });

  } catch (err) {
    res.status(500).send(err);
  }
});

// Função para enviar SMS (usando 'axios')
const sendSMS = (name, phone, endDate) => {
  const token = '2330:M7KqQf-CXWbDL-F3RVP0-TmJC9B';
  const senderID = 'ESHOP';
  const message = `Olá ${name}. Seja Bem-Vindo(a) à Workar! Sua subscrição é válida até ${endDate.toLocaleDateString("pt-MZ", { day: "numeric", month: "long", year: "numeric" })}.`;

  axios.post('https://api.mozesms.com/message/v2', {
    from: senderID,
    to: `+258${phone}`,
    message: message,
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  .then(response => {
    console.log('SMS enviado com sucesso:', response.data);
  })
  .catch(error => {
    console.error('Erro ao enviar SMS:', error);
  });
};

// Webhook para confirmação de pagamento
app.post('/api/payment-webhook', (req, res) => {
  const { reference, status } = req.body;

  if (status === 'success') {
    db.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?',
      ['completed', reference], (err) => {
        if (err) {
          console.error('Erro ao atualizar o status do pagamento:', err);
          return res.status(500).send('Erro ao processar pagamento');
        }
        res.sendStatus(200);
      });
  } else {
    res.sendStatus(400);
  }
});

// Serve os arquivos estáticos do Vite após o build
// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static(path.join(__dirname, 'dist')));

//   // Redireciona qualquer requisição para o arquivo index.html
//   app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
//   });
// }

// Iniciar o servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
