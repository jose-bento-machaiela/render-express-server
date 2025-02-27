import express from 'express';
import mysql from 'mysql2';
import bodyParser from 'body-parser';
import cors from 'cors';
import axios from 'axios';
import request from 'request';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Configuração da conexão MySQL
const db = mysql.createPool({
  host: 'nudata.digital',
  user: 'u730982402_nudata',
  password: 'jKXXxu+2O',
  database: 'u730982402_nudata_data',
  connectionLimit: 10,
});

// Função para enviar SMS
const sendSMS = (name, phone, endDate) => {
  const token = '2330:M7KqQf-CXWbDL-F3RVP0-TmJC9B'; // Seu token de autorização
  const senderID = 'MOZOTP'; // Sender ID (nome que aparecerá no SMS)

  // Mensagem personalizada com o nome e data de término da subscrição
  const message = `Olá ${name}. Seja Bem-Vindo(a) à Workar! A partir de hoje receberá notificações de Vagas de Emprego e Oportunidades de Carreira e Negócios por SMS. A tua subscrição está activa até ${endDate.toLocaleDateString("pt-MZ", {day: "numeric", month: "long", year: "numeric", })}. Workar - O Sucesso Começa Agora!`;

  var options = {
    method: 'POST',
    url: 'https://api.mozesms.com/message/v2',
    headers: {
      'Authorization': `Bearer ${token}`, // Token de autorização
    },
    form: {
      'from': senderID, // Sender ID
      'to': `+258${phone}`, // Número de telefone do destinatário com código de país (+258)
      'message': message, // Mensagem
    },
  };

  // Envio do SMS usando o request
  request(options, function (error, response) {
    if (error) {
      console.error('Erro ao enviar SMS:', error);
    } else {
      console.log('SMS enviado com sucesso:', response.body);
    }
  });
};

// Função para processar o pagamento via Emola ou Mpesa
const processPayment = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      let paymentResponse;
      // Determinar qual API chamar baseado no número de telefone
      if (data.numero.startsWith('86') || data.numero.startsWith('87')) {
        // Chamar API do Emola
        paymentResponse = await callEmolaAPI(data);
      } else if (data.numero.startsWith('84') || data.numero.startsWith('85')) {
        // Chamar API do Mpesa
        paymentResponse = await callMpesaAPI(data);
      } else {
        reject('Número inválido para pagamento');
      }

      if (paymentResponse.success) {
        resolve(paymentResponse);  // Retorna sucesso
      } else {
        reject('Erro ao processar pagamento');
      }
    } catch (error) {
      reject('Erro ao processar pagamento');
    }
  });
};

// Chamada da API do Emola
const callEmolaAPI = (data) => {
  return new Promise((resolve, reject) => {
    const requestData = {
      "carteira": "1740000734330x499085105921785860",  // Usando variável de ambiente para o ID da carteira
      "numero": data.numero,
      "quem comprou": data.nome,
      "valor": "49",
    };

    axios.post('https://mozpayment.co.mz/api/1.1/wf/pagamentorotativoemola', requestData)
      .then((response) => {
        // Verifica se o status e a resposta estão conforme o esperado para Emola
        if (response.data.status === 'success' && response.data.response.success === true) {
          resolve({ success: true, paymentUrl: 'Pagamento realizado com sucesso via Emola!' });
        } else {
          // Caso a resposta seja diferente do esperado, rejeita a promessa
          reject('Erro ao processar pagamento via Emola: resposta inválida');
        }
      })
      .catch((error) => {
        console.error('Erro ao processar pagamento via Emola:', error);
        reject('Erro ao realizar o pagamento via Emola');
      });
  });
};

// Chamada da API do Mpesa
const callMpesaAPI = (data) => {
  return new Promise((resolve, reject) => {
    const requestData = {
      "carteira": "1740000734330x499085105921785860", // Usando variável de ambiente para o ID da carteira
      "numero": data.numero,
      "quem comprou": data.nome,
      "valor": "49",
    };

    axios.post('https://mozpayment.co.mz/api/1.1/wf/pagamentorotativompesa', requestData)
      .then((response) => {
        // Verifica se o status e a resposta estão conforme o esperado para Mpesa
        if (response.data.status === 'success' && response.data.response.status === 200) {
          resolve({ success: true, paymentUrl: 'Pagamento realizado com sucesso via Mpesa!' });
        } else {
          // Caso a resposta seja diferente do esperado, rejeita a promessa
          reject('Erro ao processar pagamento via Mpesa: resposta inválida');
        }
      })
      .catch((error) => {
        console.error('Erro ao processar pagamento via Mpesa:', error);
        reject('Erro ao realizar o pagamento via Mpesa');
      });
  });
};

// Rota para criar uma subscrição
app.post('/api/subscriptions', async (req, res) => {
  const { name, phone, email, city, jobAreas, valor } = req.body;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + 30);  // A subscrição vai até 30 dias depois

  const subscription = {
    name,
    phone,
    email,
    city,
    job_areas: JSON.stringify(jobAreas),
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    payment_status: 'pending'
  };

  // Inserir a subscrição no banco de dados
  db.query('INSERT INTO subscriptions SET ?', subscription, async (err, result) => {
    if (err) {
      return res.status(500).send(err);
    }

    const paymentData = {
      nome: name,
      numero: phone,
      valor,
    };

    try {
      const paymentResponse = await processPayment(paymentData);  // Processar pagamento
      // Se pagamento for bem-sucedido
      if (paymentResponse.success) {
        // Atualizar status da subscrição
        db.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?', ['completed', result.insertId], (err) => {
          if (err) console.error(err);
        });

        // Enviar SMS de boas-vindas
        sendSMS(name, phone, endDate);

        res.json({ message: 'Pagamento realizado com sucesso', paymentUrl: paymentResponse.paymentUrl });
      } else {
        // Caso o pagamento não seja bem-sucedido, deletar a subscrição
        db.query('DELETE FROM subscriptions WHERE id = ?', [result.insertId], (err) => {
          if (err) {
            console.error('Erro ao deletar a subscrição após falha no pagamento:', err);
          }
        });
        res.status(400).json({ message: 'Erro ao processar o pagamento' });
      }
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      // Deletar a subscrição em caso de falha
      db.query('DELETE FROM subscriptions WHERE id = ?', [result.insertId], (err) => {
        if (err) {
          console.error('Erro ao deletar a subscrição após falha no pagamento:', err);
        }
      });
      res.status(400).json({ message: 'Erro ao processar pagamento' });
    }
  });
});

// Iniciar o servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));










// import express from 'express';
// import mysql from 'mysql2';
// import bodyParser from 'body-parser';
// import cors from 'cors';
// import axios from 'axios';
// import request from 'request';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// // Configuração da conexão MySQL
// const db = mysql.createPool({
//   host: 'nudata.digital',  //  
//   user: 'u730982402_nudata',   // 
//   password: 'jKXXxu+2O',  // 
//   database: 'u730982402_nudata_data',  // 
//   connectionLimit: 10,  //  
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

// // Função para processar o pagamento via Emola ou Mpesa
// const processPayment = (data) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       let paymentResponse;
//       // Determinar qual API chamar baseado no número de telefone
//       if (data.numero.startsWith('86') || data.numero.startsWith('87')) {
//         // Chamar API do Emola
//         paymentResponse = await callEmolaAPI(data);
//       } else if (data.numero.startsWith('84') || data.numero.startsWith('85')) {
//         // Chamar API do Mpesa
//         paymentResponse = await callMpesaAPI(data);
//       } else {
//         reject('Número inválido para pagamento');
//       }

//       if (paymentResponse.success) {
//         resolve(paymentResponse);  // Retorna sucesso
//       } else {
//         reject('Erro ao processar pagamento');
//       }
//     } catch (error) {
//       reject('Erro ao processar pagamento');
//     }
//   });
// };

// // Chamada da API do Emola
// const callEmolaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     const requestData = {
//       "carteira": '1740000734330x499085105921785860',  // Substitua pelo ID da sua carteira
//       "numero": data.numero,
//       "quem comprou": data.nome,
//       "valor": "5",
//     };

//     axios.post('https://mozpayment.co.mz/api/1.1/wf/pagamentorotativoemola', requestData)
//       .then((response) => {
//         if (response.success === true) {
//           resolve({ success: true, paymentUrl: 'Pagamento realizado com sucesso via Emola!' });
//         } else {
//           reject('Erro ao realizar o pagamento via Emola');
//         }
//       })
//       .catch((error) => {
//         console.error('Erro ao processar pagamento via Emola:', error);
//         reject('Erro ao realizar o pagamento via Emola');
//       });
//   });
// };

// // Chamada da API do Mpesa
// const callMpesaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     const requestData = {
//       "carteira": '1740000734330x499085105921785860',  // Substitua pelo ID da sua carteira
//       "numero": data.numero,
//       "quem comprou": data.nome,
//       "valor": "5",
//     };

//     axios.post('https://mozpayment.co.mz/api/1.1/wf/pagamentorotativompesa', requestData)
//       .then((response) => {
//         if (response.status === 200) {
//           resolve({ success: true, paymentUrl: 'Pagamento realizado com sucesso via Mpesa!' });
//         } else if (response.status === 201) {
//           reject('Erro na Transação');
//         } else if (response.status === 422) {
//           reject('Saldo Insuficiente');
//         } else if (response.status === 400) {
//           reject('PIN Errado');
//         } else {
//           reject('Erro ao processar pagamento via Mpesa');
//         }
//       })
//       .catch((error) => {
//         console.error('Erro ao processar pagamento via Mpesa:', error);
//         reject('Erro ao realizar o pagamento via Mpesa');
//       });
//   });
// };

// // Rota para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   const { name, phone, email, city, jobAreas, valor } = req.body;

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
//   db.query('INSERT INTO subscriptions SET ?', subscription, async (err, result) => {
//     if (err) {
//       return res.status(500).send(err);
//     }

//     const paymentData = {
//       nome: name,
//       numero: phone,
//       valor,
//     };

//     try {
//       const paymentResponse = await processPayment(paymentData);  // Processar pagamento
//       // Se pagamento for bem-sucedido
//       if (paymentResponse.success) {
//         // Atualizar status da subscrição
//         db.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?', ['completed', result.insertId], (err) => {
//           if (err) console.error(err);
//         });



//         // Enviar SMS de boas-vindas
//         sendSMS(name, phone, endDate);



//         res.json({ message: 'Pagamento realizado com sucesso', paymentUrl: paymentResponse.paymentUrl });
//       } else {
//         // Caso o pagamento não seja bem-sucedido, deletar a subscrição
//         db.query('DELETE FROM subscriptions WHERE id = ?', [result.insertId], (err) => {
//           if (err) {
//             console.error('Erro ao deletar a subscrição após falha no pagamento:', err);
//           }
//         });
//         res.status(400).json({ message: 'Erro ao processar o pagamento' });
//         console.log(err)
//       }
//     } catch (error) {
//       console.error('Erro ao processar pagamento:', error);
//       // Deletar a subscrição em caso de falha
//       db.query('DELETE FROM subscriptions WHERE id = ?', [result.insertId], (err) => {
//         if (err) {
//           console.error('Erro ao deletar a subscrição após falha no pagamento:', err);
//         }
//       });
//       res.status(400).json({ message: 'Erro ao processar pagamento' });
//       console.log(err)
//     }
//   });
// });

// // Iniciar o servidor
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));














// import express from 'express';
// import mysql from 'mysql2';
// import bodyParser from 'body-parser';
// import cors from 'cors';
// import request from 'request';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// // Configuração da conexão MySQL
// const db = mysql.createPool({
//   host: 'nudata.digital', //
//   user: 'u730982402_nudata', //
//   password: 'jKXXxu+2O', //
//   database: 'u730982402_nudata_data', //
//   connectionLimit: 10,
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

// // Função para decidir qual API chamar com base no número de telefone
// const processPayment = (phone, data) => {
//   if (phone.startsWith('86') || phone.startsWith('87')) {
//     return callEmolaAPI(data);
//   } else if (phone.startsWith('84') || phone.startsWith('85')) {
//     return callMpesaAPI(data);
//   } else {
//     return Promise.reject('Número inválido para pagamento');
//   }
// };

// // Função para chamar a API do Emola
// const callEmolaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     request.post({
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativoemola',
//       json: data,
//     }, (error, response, body) => {
//       if (error || response.statusCode !== 200 || body.success !== true) {
//         return reject('Erro ao realizar o pagamento via Emola');
//       }
//       resolve({ paymentUrl: 'Pagamento realizado com sucesso via Emola!' });
//     });
//   });
// };

// // Função para chamar a API do Mpesa
// const callMpesaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     request.post({
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativompesa',
//       json: data,
//     }, (error, response, body) => {
//       if (error || response.statusCode !== 200) {
//         return reject('Erro ao realizar o pagamento via Mpesa');
//       }

//       if (body.status === 200) {
//         resolve({ paymentUrl: 'Pagamento realizado com sucesso via Mpesa!' });
//       } else if (body.status === 201) {
//         reject('Erro na transação com Mpesa.');
//       } else if (body.status === 422) {
//         reject('Saldo insuficiente no Mpesa.');
//       } else if (body.status === 400) {
//         reject('PIN errado no Mpesa.');
//       } else {
//         reject('Erro desconhecido no Mpesa.');
//       }
//     });
//   });
// };

// // Rota para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   try {
//     const { name, phone, email, city, jobAreas } = req.body;

//     // Verificar se o telefone é válido
//     if (!phone || !phone.trim()) {
//       return res.status(400).json({ error: 'Número de telefone é obrigatório e não pode ser vazio.' });
//     }

//     // Verificar se o valor de phone tem o prefixo adequado
//     if (!phone.startsWith('86') && !phone.startsWith('87') && !phone.startsWith('84') && !phone.startsWith('85')) {
//       return res.status(400).json({ error: 'Número de telefone inválido. Os números devem começar com 86, 87, 84 ou 85.' });
//     }

//     const startDate = new Date();
//     const endDate = new Date();
//     endDate.setDate(startDate.getDate() + 30);  // A subscrição vai até 30 dias depois

//     const subscription = {
//       name,
//       phone,
//       email,
//       city,
//       job_areas: JSON.stringify(jobAreas),
//       start_date: startDate.toISOString().split('T')[0],
//       end_date: endDate.toISOString().split('T')[0],
//       payment_status: 'pending'
//     };

//     // Usando uma conexão do pool para transações
//     db.getConnection(function (err, connection) {
//       if (err) {
//         return res.status(500).send(err);
//       }

//       // Iniciar a transação
//       connection.beginTransaction(function (err) {
//         if (err) {
//           connection.release();
//           return res.status(500).send(err);
//         }

//         // Inserir a subscrição no banco de dados
//         connection.query('INSERT INTO subscriptions SET ?', subscription, (err, result) => {
//           if (err) {
//             return connection.rollback(() => {
//               connection.release();
//               res.status(500).send(err);
//             });
//           }

//           // Commit da transação
//           connection.commit(function (err) {
//             if (err) {
//               return connection.rollback(() => {
//                 connection.release();
//                 res.status(500).send(err);
//               });
//             }

//             connection.release(); // Libera a conexão após o commit

//             // Criar os dados do pagamento
//             const paymentData = {
//               "carteira": '1740000734330x499085105921785860',
//               "numero": phone,
//               "quem comprou": name,
//               "valor": "5" // valor do pagamento
//             };

//             // Chamar a função para processar o pagamento com base no número de telefone
//             processPayment(phone, paymentData)
//               .then(response => {
//                 // Se pagamento realizado com sucesso, responder com o link de pagamento
//                 res.json({ paymentUrl: response.paymentUrl });

//                 // Enviar SMS após a confirmação do pagamento e após salvar no banco de dados
//                 sendSMS(name, phone, endDate);
//               })
//               .catch(err => {
//                 // Caso erro no pagamento, remover a subscrição
//                 console.error('Erro ao processar pagamento:', err);
//                 db.query('DELETE FROM subscriptions WHERE id = ?', [result.insertId], (deleteErr) => {
//                   if (deleteErr) {
//                     console.error('Erro ao deletar a subscrição após falha no pagamento:', deleteErr);
//                   }
//                 });
//                 res.status(500).json({ error: 'Erro ao processar pagamento: ' + err });
//               });
//           });
//         });
//       });
//     });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

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
// import request from 'request';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// // Configuração da conexão MySQL
// const db = mysql.createPool({
//   host: 'nudata.digital', //
//   user: 'u730982402_nudata', //
//   password: 'jKXXxu+2O', //
//   database: 'u730982402_nudata_data', //
//   connectionLimit: 10,
// });

// // Função para decidir qual API chamar com base no número de telefone
// const processPayment = (phone, data) => {
//   // Verificar se o telefone está definido e é uma string
//   if (typeof phone !== 'string' || phone.trim() === '') {
//     return Promise.reject('Número de telefone inválido ou ausente');
//   }

//   // Verificar o prefixo do número
//   if (phone.startsWith('86') || phone.startsWith('87')) {
//     // Chamar API do Emola
//     return callEmolaAPI(data);
//   } else if (phone.startsWith('84') || phone.startsWith('85')) {
//     // Chamar API do Mpesa
//     return callMpesaAPI(data);
//   } else {
//     return Promise.reject('Número inválido para pagamento');
//   }
// };

// // Função para chamar a API do Emola
// const callEmolaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     request.post({
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativoemola',
//       json: data,
//     }, (error, response, body) => {
//       if (error || response.statusCode !== 200 || body.success !== true) {
//         return reject('Erro ao realizar o pagamento via Emola');
//       }
//       resolve({ paymentUrl: 'Pagamento realizado com sucesso via Emola!' });
//     });
//   });
// };

// // Função para chamar a API do Mpesa
// const callMpesaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     request.post({
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativompesa',
//       json: data,
//     }, (error, response, body) => {
//       if (error || response.statusCode !== 200) {
//         return reject('Erro ao realizar o pagamento via Mpesa');
//       }

//       // Verificar os códigos de status da resposta do Mpesa
//       if (body.status === 200) {
//         resolve({ paymentUrl: 'Pagamento realizado com sucesso via Mpesa!' });
//       } else if (body.status === 201) {
//         reject('Erro na transação com Mpesa.');
//       } else if (body.status === 422) {
//         reject('Saldo insuficiente no Mpesa.');
//       } else if (body.status === 400) {
//         reject('PIN errado no Mpesa.');
//       } else {
//         reject('Erro desconhecido no Mpesa.');
//       }
//     });
//   });
// };

// // Rota para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   try {
//     const { name, phone, email, city, jobAreas } = req.body;

//     // Verificar se o telefone é válido
//     if (!phone || !phone.trim()) {
//       return res.status(400).json({ error: 'Número de telefone é obrigatório e não pode ser vazio.' });
//     }

//     // Verificar se o valor de phone tem o prefixo adequado
//     if (!phone.startsWith('86') && !phone.startsWith('87') && !phone.startsWith('84') && !phone.startsWith('85')) {
//       return res.status(400).json({ error: 'Número de telefone inválido. Os números devem começar com 86, 87, 84 ou 85.' });
//     }

//     const startDate = new Date();
//     const endDate = new Date();
//     endDate.setDate(startDate.getDate() + 30);  // A subscrição vai até 30 dias depois

//     const subscription = {
//       name,
//       phone,
//       email,
//       city,
//       job_areas: JSON.stringify(jobAreas),
//       start_date: startDate.toISOString().split('T')[0],
//       end_date: endDate.toISOString().split('T')[0],
//       payment_status: 'pending'
//     };

//     // Usando uma conexão do pool para transações
//     db.getConnection(function (err, connection) {
//       if (err) {
//         return res.status(500).send(err);
//       }

//       // Iniciar a transação
//       connection.beginTransaction(function (err) {
//         if (err) {
//           connection.release();
//           return res.status(500).send(err);
//         }

//         // Inserir a subscrição no banco de dados
//         connection.query('INSERT INTO subscriptions SET ?', subscription, (err, result) => {
//           if (err) {
//             return connection.rollback(() => {
//               connection.release();
//               res.status(500).send(err);
//             });
//           }

//           // Commit da transação
//           connection.commit(function (err) {
//             if (err) {
//               return connection.rollback(() => {
//                 connection.release();
//                 res.status(500).send(err);
//               });
//             }

//             connection.release(); // Libera a conexão após o commit

//             // Criar os dados do pagamento
//             const paymentData = {
//               "carteira": '1740000734330x499085105921785860',
//               "numero": phone,
//               "quem comprou": name,
//               "valor": 2 // valor do pagamento
//             };

//             // Chamar a função para processar o pagamento com base no número de telefone
//             processPayment(phone, paymentData)
//               .then(response => {
//                 // Se pagamento realizado com sucesso, responder com o link de pagamento
//                 res.json({ paymentUrl: response.paymentUrl });
//               })
//               .catch(err => {
//                 // Caso erro no pagamento, remover a subscrição
//                 console.error('Erro ao processar pagamento:', err);
//                 db.query('DELETE FROM subscriptions WHERE id = ?', [result.insertId], (deleteErr) => {
//                   if (deleteErr) {
//                     console.error('Erro ao deletar a subscrição após falha no pagamento:', deleteErr);
//                   }
//                 });
//                 res.status(500).json({ error: 'Erro ao processar pagamento: ' + err });
//               });
//           });
//         });
//       });
//     });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

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
// import request from 'request';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// // Configuração da conexão MySQL
// const db = mysql.createPool({
//   host: 'nudata.digital', //
//   user: 'u730982402_nudata', //
//   password: 'jKXXxu+2O', //
//   database: 'u730982402_nudata_data', //
//   connectionLimit: 10,
// });

// // Função para decidir qual API chamar com base no número de telefone
// const processPayment = (phone, data) => {
//   // Verificar se o telefone está definido e é uma string
//   if (typeof phone !== 'string' || phone.trim() === '') {
//     return Promise.reject('Número de telefone inválido ou ausente');
//   }

//   // Verificar o prefixo do número
//   if (phone.startsWith('86') || phone.startsWith('87')) {
//     // Chamar API do Emola
//     return callEmolaAPI(data);
//   } else if (phone.startsWith('84') || phone.startsWith('85')) {
//     // Chamar API do Mpesa
//     return callMpesaAPI(data);
//   } else {
//     return Promise.reject('Número inválido para pagamento');
//   }
// };

// // Função para chamar a API do Emola
// const callEmolaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     request.post({
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativoemola',
//       json: data,
//     }, (error, response, body) => {
//       if (error || response.statusCode !== 200) {
//         return reject('Erro ao realizar o pagamento via Emola');
//       }
//       resolve({ paymentUrl: body.paymentUrl || 'URL de pagamento do Emola' });
//     });
//   });
// };

// // Função para chamar a API do Mpesa
// const callMpesaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     request.post({
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativompesa',
//       json: data,
//     }, (error, response, body) => {
//       if (error || response.statusCode !== 200) {
//         return reject('Erro ao realizar o pagamento via Mpesa');
//       }
//       resolve({ paymentUrl: body.paymentUrl || 'URL de pagamento do Mpesa' });
//     });
//   });
// };

// // Rota para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   try {
//     const { name, phone, email, city, jobAreas } = req.body;

//     // Verificar se o telefone é válido
//     if (!phone || !phone.trim()) {
//       return res.status(400).json({ error: 'Número de telefone é obrigatório e não pode ser vazio.' });
//     }

//     // Verificar se o valor de phone tem o prefixo adequado
//     if (!phone.startsWith('86') && !phone.startsWith('87') && !phone.startsWith('84') && !phone.startsWith('85')) {
//       return res.status(400).json({ error: 'Número de telefone inválido. Os números devem começar com 86, 87, 84 ou 85.' });
//     }

//     const startDate = new Date();
//     const endDate = new Date();
//     endDate.setDate(startDate.getDate() + 30);  // A subscrição vai até 30 dias depois

//     const subscription = {
//       name,
//       phone,
//       email,
//       city,
//       job_areas: JSON.stringify(jobAreas),
//       start_date: startDate.toISOString().split('T')[0],
//       end_date: endDate.toISOString().split('T')[0],
//       payment_status: 'pending'
//     };

//     // Usando uma conexão do pool para transações
//     db.getConnection(function (err, connection) {
//       if (err) {
//         return res.status(500).send(err);
//       }

//       // Iniciar a transação
//       connection.beginTransaction(function (err) {
//         if (err) {
//           connection.release();
//           return res.status(500).send(err);
//         }

//         // Inserir a subscrição no banco de dados
//         connection.query('INSERT INTO subscriptions SET ?', subscription, (err, result) => {
//           if (err) {
//             return connection.rollback(() => {
//               connection.release();
//               res.status(500).send(err);
//             });
//           }

//           // Commit da transação
//           connection.commit(function (err) {
//             if (err) {
//               return connection.rollback(() => {
//                 connection.release();
//                 res.status(500).send(err);
//               });
//             }

//             connection.release(); // Libera a conexão após o commit

//             // Criar os dados do pagamento
//             const paymentData = {
//               "carteira": '1740000734330x499085105921785860',
//               "numero": phone,
//               "quem comprou": name,
//               "valor": 2 // valor do pagamento
//             };

//             // Chamar a função para processar o pagamento com base no número de telefone
//             processPayment(phone, paymentData)
//               .then(response => {
//                 // Redirecionar para a URL de pagamento após sucesso
//                 res.json({ paymentUrl: response.paymentUrl || 'URL de pagamento do Emola ou Mpesa' });
//               })
//               .catch(err => {
//                 // Caso erro no pagamento, remover a subscrição
//                 console.error('Erro ao processar pagamento:', err);
//                 db.query('DELETE FROM subscriptions WHERE id = ?', [result.insertId], (deleteErr) => {
//                   if (deleteErr) {
//                     console.error('Erro ao deletar a subscrição após falha no pagamento:', deleteErr);
//                   }
//                 });
//                 res.status(500).json({ error: 'Erro ao processar pagamento: ' + err });
//               });
//           });
//         });
//       });
//     });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

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
// import request from 'request';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// // Configuração da conexão MySQL com pool de conexões
// const db = mysql.createPool({
//   host: 'nudata.digital',
//   user: 'u730982402_nudata',
//   password: 'jKXXxu+2O',
//   database: 'u730982402_nudata_data',
//   connectionLimit: 10,
// });

// // Função para enviar SMS
// const sendSMS = (name, phone, endDate) => {
//   const token = '2330:M7KqQf-CXWbDL-F3RVP0-TmJC9B'; // Seu token de autorização
//   const senderID = 'ESHOP'; // Sender ID (nome que aparecerá no SMS)

//   const message = `Olá ${name}. Seja Bem-Vindo(a) à Workar! A partir de hoje receberá notificações de Vagas de Emprego e Oportunidades de Carreira e Negócios por SMS. A tua subscrição está activa até ${endDate.toLocaleDateString("pt-MZ", {day: "numeric", month: "long", year: "numeric", })}. Workar - O Sucesso Começa Agora!`;

//   const options = {
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

// // Função para chamar a API do Emola
// const callEmolaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     const options = {
//       method: 'POST',
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativoemola',
//       json: true,
//       body: data
//     };
    
//     request(options, function (error, response) {
//       if (error || response.body.success !== true) {
//         return reject('Erro ao realizar o pagamento via Emola');
//       }
//       resolve(response.body);
//     });
//   });
// };

// // Função para chamar a API do Mpesa
// const callMpesaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     const options = {
//       method: 'POST',
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativompesa',
//       json: true,
//       body: data
//     };

//     request(options, function (error, response) {
//       if (error || response.statusCode !== 200) {
//         return reject('Erro ao realizar o pagamento via Mpesa');
//       }
//       resolve(response.body);
//     });
//   });
// };

// // Função para decidir qual API chamar com base no número de telefone
// const processPayment = (phone, data) => {

//   if (typeof phone !== 'string' || phone.trim() === '') {
//     return Promise.reject('Número de telefone inválido ou ausente');
//   }

//   // Verificar o prefixo do número
//   if (phone.startsWith('86') || phone.startsWith('87')) {
//     // Chamar API do Emola
//     return callEmolaAPI(data);
//   } else if (phone.startsWith('84') || phone.startsWith('85')) {
//     // Chamar API do Mpesa
//     return callMpesaAPI(data);
//   } else {
//     return Promise.reject('Número inválido para pagamento');
//   }
// };

// // Rota para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   try {
//     const { name, phone, email, city, jobAreas } = req.body;

//     const startDate = new Date();
//     const endDate = new Date();
//     endDate.setDate(startDate.getDate() + 30);  // A subscrição vai até 30 dias depois

//     const subscription = {
//       name,
//       phone,
//       email,
//       city,
//       job_areas: JSON.stringify(jobAreas),
//       start_date: startDate.toISOString().split('T')[0],
//       end_date: endDate.toISOString().split('T')[0],
//       payment_status: 'pending'
//     };

//     // Usando uma conexão do pool para transações
//     db.getConnection(function (err, connection) {
//       if (err) {
//         return res.status(500).send(err);
//       }

//       // Iniciar a transação
//       connection.beginTransaction(function (err) {
//         if (err) {
//           connection.release();
//           return res.status(500).send(err);
//         }

//         // Inserir a subscrição no banco de dados
//         connection.query('INSERT INTO subscriptions SET ?', subscription, (err, result) => {
//           if (err) {
//             return connection.rollback(() => {
//               connection.release();
//               res.status(500).send(err);
//             });
//           }

//           // Commit da transação
//           connection.commit(function (err) {
//             if (err) {
//               return connection.rollback(() => {
//                 connection.release();
//                 res.status(500).send(err);
//               });
//             }

//             connection.release(); // Libera a conexão após o commit

//             // Após inserir a subscrição, enviar o SMS de boas-vindas
//               // Exemplo de um número especial para teste
//               // sendSMS(name, phone, endDate);

//             // Criar os dados do pagamento
//             const paymentData = {
//               carteira: 'unique_id_da_sua_carteira',
//               numero: phone,
//               quem_comprou: name,
//               valor: 49 // valor do pagamento
//             };

//             // Chamar a função para processar o pagamento com base no número de telefone
//             processPayment(phone, paymentData)
//               .then(response => {
//                 // Redirecionar para a URL de pagamento após sucesso
//                 res.json({ paymentUrl: response.paymentUrl || 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativoemola' });
//               })
//               .catch(err => {
//                 console.error('Erro ao processar pagamento:', err);
//                 res.status(500).json({ error: err });
//               });
//           });
//         });
//       });
//     });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// // Webhook para confirmação de pagamento
// app.post('/api/payment-webhook', (req, res) => {
//   const { reference, status } = req.body;

//   // Verificar se o status é de sucesso
//   if (status === 'success') {
//     // Atualizar status de pagamento no banco de dados
//     db.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?',
//       ['completed', reference], (err) => {
//         if (err) {
//           console.error("Erro ao atualizar pagamento:", err);
//           return res.status(500).send("Erro ao atualizar pagamento");
//         }
//         console.log(`Pagamento confirmado para a subscrição ID: ${reference}`);
//       });
//   } else {
//     console.log(`Pagamento falhou ou foi cancelado. Referência: ${reference}`);
//   }

//   // Retornar status de sucesso ao provedor de pagamento
//   res.sendStatus(200);
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));








// import express from 'express';
// import mysql from 'mysql2';
// import bodyParser from 'body-parser';
// import cors from 'cors';
// import request from 'request';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// // Configuração da conexão MySQL com pool de conexões
// const db = mysql.createPool({
//   host: 'localhost', // nudata.digital
//   user: 'root', // u730982402_nudata
//   password: '', // jKXXxu+2O
//   database: 'seu_banco', // u730982402_nudata_data
//   connectionLimit: 10,
// });

// // Função para enviar SMS
// const sendSMS = (name, phone, endDate) => {
//   const token = '2330:M7KqQf-CXWbDL-F3RVP0-TmJC9B'; // Seu token de autorização
//   const senderID = 'ESHOP'; // Sender ID (nome que aparecerá no SMS)

//   const message = `Olá ${name}. Seja Bem-Vindo(a) à Workar! A partir de hoje receberá notificações de Vagas de Emprego e Oportunidades de Carreira e Negócios por SMS. A tua subscrição está activa até ${endDate.toLocaleDateString("pt-MZ", {day: "numeric", month: "long", year: "numeric", })}. Workar - O Sucesso Começa Agora!`;

//   const options = {
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

// // Função para chamar a API do Emola
// const callEmolaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     const options = {
//       method: 'POST',
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativoemola',
//       json: true,
//       body: data
//     };
    
//     request(options, function (error, response) {
//       if (error || response.body.success !== true) {
//         return reject('Erro ao realizar o pagamento via Emola');
//       }
//       resolve(response.body);
//     });
//   });
// };

// // Função para chamar a API do Mpesa
// const callMpesaAPI = (data) => {
//   return new Promise((resolve, reject) => {
//     const options = {
//       method: 'POST',
//       url: 'https://mozpayment.co.mz/api/1.1/wf/pagamentorotativompesa',
//       json: true,
//       body: data
//     };

//     request(options, function (error, response) {
//       if (error || response.statusCode !== 200) {
//         return reject('Erro ao realizar o pagamento via Mpesa');
//       }
//       resolve(response.body);
//     });
//   });
// };

// // Função para decidir qual API chamar com base no número de telefone
// const processPayment = (phone, data) => {
//   // Verificar o prefixo do número
//   if (phone.startsWith('86') || phone.startsWith('87')) {
//     // Chamar API do Emola
//     return callEmolaAPI(data);
//   } else if (phone.startsWith('84') || phone.startsWith('85')) {
//     // Chamar API do Mpesa
//     return callMpesaAPI(data);
//   } else {
//     return Promise.reject('Número inválido para pagamento');
//   }
// };

// // Rota para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   try {
//     const { name, phone, email, city, jobAreas } = req.body;

//     const startDate = new Date();
//     const endDate = new Date();
//     endDate.setDate(startDate.getDate() + 30);  // A subscrição vai até 30 dias depois

//     const subscription = {
//       name,
//       phone,
//       email,
//       city,
//       job_areas: JSON.stringify(jobAreas),
//       start_date: startDate.toISOString().split('T')[0],
//       end_date: endDate.toISOString().split('T')[0],
//       payment_status: 'pending'
//     };

//     // Usando transação para garantir a integridade do banco de dados
//     db.beginTransaction(function (err) {
//       if (err) {
//         return res.status(500).send(err);
//         console.log(err)
//       }

//       db.query('INSERT INTO subscriptions SET ?', subscription, (err, result) => {
//         if (err) {
//           return db.rollback(() => {
//             res.status(500).send(err);
//           });
//         }

//         // Commit da transação se tudo correr bem
//         db.commit(function (err) {
//           if (err) {
//             return db.rollback(() => {
//               res.status(500).send(err);
//             });
//           }

//           // Após inserir a subscrição, enviar o SMS de boas-vindas
//            // Exemplo de um número especial para teste
//           // sendSMS(name, phone, endDate);
          

//           // Criar os dados do pagamento  1740000734330x499085105921785860
//           const paymentData = {
//             carteira: '1740000734330x499085105921785860',
//             numero: phone,
//             quem_comprou: name,
//             valor: 2 // valor do pagamento
//           };

//           // Chamar a função para processar o pagamento com base no número de telefone
//           processPayment(phone, paymentData)
//             .then(response => {
//               // Redirecionar para a URL de pagamento após sucesso
//               res.json({ paymentUrl: response.paymentUrl || 'URL de pagamento do Emola ou Mpesa' });
//             })
//             .catch(err => {
//               console.error('Erro ao processar pagamento:', err);
//               res.status(500).json({ error: err });
//             });
//         });
//       });
//     });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// // Webhook para confirmação de pagamento
// app.post('/api/payment-webhook', (req, res) => {
//   const { reference, status } = req.body;

//   // Verificar se o status é de sucesso
//   if (status === 'success') {
//     // Atualizar status de pagamento no banco de dados
//     db.query('UPDATE subscriptions SET payment_status = ? WHERE id = ?',
//       ['completed', reference], (err) => {
//         if (err) {
//           console.error("Erro ao atualizar pagamento:", err);
//           return res.status(500).send("Erro ao atualizar pagamento");
//         }
//         console.log(`Pagamento confirmado para a subscrição ID: ${reference}`);
//       });
//   } else {
//     console.log(`Pagamento falhou ou foi cancelado. Referência: ${reference}`);
//   }

//   // Retornar status de sucesso ao provedor de pagamento
//   res.sendStatus(200);
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));












// import express from 'express';
// import mysql from 'mysql2';
// import bodyParser from 'body-parser';
// import cors from 'cors';
// import request from 'request';
// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// // Configuração da conexão MySQL
// // const db = mysql.createConnection({
// //   host: 'localhost',  // nudata.digital
// //   user: 'root', // u730982402_nudata
// //   password: '', // jKXXxu+2O
// //   database: 'seu_banco', // u730982402_nudata_data
// //   connectionLimit: 10, // Limite de conexões simultâneas
// //   // connectTimeout: 10000,  // Tempo máximo de espera para se conectar (10 segundos)
// //   // acquireTimeout: 10000,  // Tempo máximo de espera para obter uma conexão (10 segundos)
// // });

// const db = mysql.createPool({
//     host: 'localhost', //
//     user: 'root', //
//     password: '', //
//     database: 'test', //
//     connectionLimit: 10,
//   });

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
//     if(phone == 876876543){
//       // sendSMS(name, phone, endDate);
//     }
    

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





















// import express from 'express';
// import mysql from 'mysql2';
// import bodyParser from 'body-parser';
// import cors from 'cors';
// import axios from 'axios'; // Substituindo 'request' por 'axios'
// import path from 'path'; // Usado para resolver o caminho do arquivo

// import dotenv from 'dotenv';
// dotenv.config();

// const app = express();


// // Habilitar CORS (apenas para desenvolvimento, para produção, altere o origin)
// app.use(cors({
//   // origin: 'http://localhost:5173' // Modifique isso para o seu domínio de produção
// }));

// app.use(bodyParser.json());

// // Configuração do pool de conexões MySQL
// const db = mysql.createPool({
//   host: 'nudata.digital', //
//   user: 'u730982402_nudata', //
//   password: 'jKXXxu+2O', //
//   database: 'u730982402_nudata_data', //
//   connectionLimit: 10,
// });

// // Função para verificar a conexão e criar a tabela 'conectacaosucesso'
// const checkConnection = () => {
//   db.getConnection((err, connection) => {
//     if (err) {
//       console.error('Erro ao conectar ao banco de dados:', err);
//       return;
//     }

//     console.log('Conectado ao banco de dados com sucesso!');

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

// checkConnection();

// // Função para criar uma subscrição
// app.post('/api/subscriptions', async (req, res) => {
//   console.log('Fazendo post');
//   const { name, phone, email, city, jobAreas } = req.body;

//   const startDate = new Date();
//   const endDate = new Date();
//   endDate.setDate(startDate.getDate() + 30);

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

//     const paymentUrl = `https://mozpayment.com/pay?amount=49&reference=${result.insertId}`;
//     res.json({ paymentUrl });

//   } catch (err) {
//     res.status(500).send(err);
//   }
// });

// // Função para enviar SMS (usando 'axios')
// const sendSMS = (name, phone, endDate) => {
//   const token = '2330:M7KqQf-CXWbDL-F3RVP0-TmJC9B';
//   const senderID = 'ESHOP';
//   const message = `Olá ${name}. Seja Bem-Vindo(a) à Workar! Sua subscrição é válida até ${endDate.toLocaleDateString("pt-MZ", { day: "numeric", month: "long", year: "numeric" })}.`;

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
//     res.sendStatus(400);
//   }
// });

// // Serve os arquivos estáticos do Vite após o build
// // if (process.env.NODE_ENV === 'production') {
// //   app.use(express.static(path.join(__dirname, 'dist')));

// //   // Redireciona qualquer requisição para o arquivo index.html
// //   app.get('*', (req, res) => {
// //     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// //   });
// // }

// // Iniciar o servidor
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
