const Discord = require("discord.js");
const ytdl = require('ytdl-core');
const configs = require('./config.json');
const google = require('googleapis');
const fs = require('fs');

const bot = new Discord.Client();

const prefixo = configs.PREFIX;

const youtube = new google.youtube_v3.Youtube({
    version: 'v3',
    auth: configs.GOOGLE_KEY
});

bot.on('guildMemberAdd', member =>{
    //Acha o canal de texto para escrever
    const channel = member.guild.channels.cache.find(ch => ch.name === 'geral');
    //caso não tenha ele retorna null
    if(!channel) return;
    //Envia a mensagem caso ache o canal
    channel.send('Bem-vindo ao server, ${member}');
});

const servidores = [];

bot.on('guildCreate', () =>{
    console.log('Id da guilda onde eu entrei: ' + guild.id);
    console.log('Nome da guilda onde entrei: ' + guild.name);

    servidores[guild.id] = {
        connection: null,
        dispatcher: null,
        fila: [],
        estouTocando: false
    }

    saveServer(guild.id);
});

bot.on('ready', () =>{
    loadServers();
    console.log('Pai tá on!');
});

bot.on('message', async (msg) =>{

    //filtros
    if (!msg.guild) return;

    if (!msg.content.startsWith(prefixo)) return;

    if (!msg.member.voice.channel){
        msg.channel.send('Você precisa estar num canal de voz!!');
        return;
    }
    //comandos
    if (msg.content === prefixo + 'join'){ //#join
        try{
            servidores[msg.guild.id].connection = await msg.member.voice.channel.join();
        }catch (err) {
            console.log("Erro ao entrar no canal de voz!");
            console.log(err);
        }
        
    }

    if (msg.content === prefixo + 'leave'){ //#leave
        msg.member.voice.channel.leave();
        servidores[msg.guild.id].connection = null;
        servidores[msg.guild.id].dispatcher = null;
        servidores[msg.guild.id].estouTocando = false;
        servidores[msg.guild.id].fila = [];
    }
    
    if (msg.content.startsWith(prefixo + 'play')){ //#play <link>
        let oQueTocar = msg.content.slice(6);

        if(oQueTocar.length === 0){
            msg.channel.send('Eu preciso de algo para tocar!');
            return;
        }

        if (servidores.server.connection === null){
            try{
                servidores[msg.guild.id].connection = await msg.member.voice.channel.join();
            }catch (err) {
                console.log("Erro ao entrar no canal de voz!");
                console.log(err);
            }
        }

        if (ytdl.validateURL(oQueTocar)){
            servidores[msg.guild.id].fila.push(oQueTocar);
            console.log('Adicionado: ' + oQueTocar);
            tocaMusicas(msg);
        }
        else{
            youtube.search.list({
                q: oQueTocar,
                part: 'snippet',
                fields: 'items(id(videoId),snippet(title,channelTitle))',
                type: 'video'
            }, function(err, resultado){
                if(err){
                    console.log(err);
                }
                if(resultado){
                    const listaResultados = [];

                    //organiza o resultado da pesquisa
                    for (let i in resultado.data.items){
                        const montaItem = {
                            'tituloVideo': resultado.data.items[i].snippet.title,
                            'nomeCanal': resultado.data.items[i].snippet.channelTitle,
                            'id': 'https://www.youtube.com/watch?v=' + resultado.data.items[i].id.videoId
                        }

                        listaResultados.push(montaItem);
                    }

                    const embed = new Discord.MessageEmbed()
                        .setColor([112,20,113])
                        .setAuthor('Bot do Luquinhas')
                        .setDescription('Escolha sua música de 1-5');

                    //adiciona campos pra cada resultado da lista
                        for (let i in listaResultados) {
                            embed.addField(
                                `${parseInt(i) + 1}: ${listaResultados[i].tituloVideo}`, 
                                listaResultados[i].nomeCanal
                            );
                        }
                    
                        msg.channel.send(embed)
                            .then((embedMessage) => {
                                const possiveisReacoes = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

                                //reage na mensagem com emojis
                                for (let i = 0; i < possiveisReacoes.lenght; i++){
                                    embedMessage.react(possiveisReacoes[i]);
                                }

                                const filter = (reaction, user) =>{
                                    return possiveisReacoes.includes(reaction.emoji.name)
                                    && user.id === msg.author.id;
                                }

                                embedMessage.awaitReactions(filter,{max: 1, time: 20000, errors: ['time']})
                                    .then((collected) =>{
                                        const reaction = collected.first();
                                        const idOpcaoEscolhida = possiveisReacoes.indexOf(reaction.emoji.name)

                                        msg.channel.send('Você escolheu ${listaResultados[idOpcaoEscolhida].tituloVideo} de ${listaResultados[idOpcaoEscolhida].nomeCanal}');

                                        servidores.server.fila.push(listaResultados[idOpcaoEscolhida].id);
                                        tocaMusicas(msg);
                                    })
                                    .catch((error) =>{
                                        msg.reply("Você não escolheu uma opção válida!");
                                        console.log(error);
                                    });
                            });
                }
            });
        }
    }

    if (msg.content === prefixo + 'pause'){ //#pause
        servidores[msg.guild.id].dispatcher.pause();
    }

    if (msg.content === prefixo + 'resume'){ //#resume
        servidores[msg.guild.id].dispatcher.resume();
    }

});

const tocaMusicas = (msg) => {
    if (servidores[msg.guild.id].estouTocando === false) {
        const tocando = servidores[msg.guild.id].fila[0];
        servidores[msg.guild.id].estouTocando = true;
        servidores[msg.guild.id].dispatcher = servidores[msg.guild.id].connection.play(ytdl(tocando, configs.YTDL));

        servidores[msg.guild.id].dispatcher.on('finish', () =>{
            servidores[msg.guild.id].fila.shift();
            servidores[msg.guild.id].estouTocando = false;
            if (servidores[msg.guild.id].fila.lenght > 0) {
                tocaMusicas();
            }
            else {
                servidores[msg.guild.id].dispatcher = null;
            }
        });
    }
    
}

const loadServers = () => {
    fs.readFile('serverList.json', 'utf8', (err, data) => {
        if(err){
            console.log('Ocorreu um erro ao ler registro de servidores');
            console.log(err);
        } else{
            const obj = JSON.parse(data);
            for (let i in obj.servers){
                servidores[i] = {
                    connection: null,
                    dispatcher: null,
                    fila: [],
                    estouTocando: false
                }
            }
        }
    });

}

const saveServer = (idNovoServidor) => {
    fs.readFile('serverList.json', 'utf8', (err, data) => {
        if(err){
            console.log('Ocorreu um erro ao ler um arquivo para tentar salvar o novo id');
            console.log(err);
        } else{
            const obj = JSON.parse(data);
            obj.servidores.push(idNovoServidor);
            const objEscreve = JSON.stringify(obj);

            fs.writeFile('serverList.json', objEscreve, 'utf8', () => {});
        }
    });
}


bot.login(configs.TOKEN_DISCORD);