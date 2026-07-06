#include <winsock2.h>
#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
#include "assettoLibraryM.h"

int main()
{
    // Winsock
    WSADATA wsa;
    WSAStartup(MAKEWORD(2, 2), &wsa);

    // socket
    SOCKET server = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(5000);
    addr.sin_addr.s_addr = INADDR_ANY;

    bind(server, (struct sockaddr *)&addr, sizeof(addr));
    listen(server, 1);

    printf("Aguardando Python na porta 5000...\n");
    SOCKET client = accept(server, NULL, NULL);
    printf("Python conectado!\n");

    // Tentar abrir shared memory do Assetto Corsa
    HANDLE hMapFile = OpenFileMappingA(FILE_MAP_READ, FALSE, "Local\\acpmf_physics");
    SPageFilePhysics *physics = NULL;
    int tem_dados = 0;

    if (hMapFile != NULL)
    {
        physics = (SPageFilePhysics *)MapViewOfFile(
            hMapFile, FILE_MAP_READ, 0, 0, sizeof(SPageFilePhysics));

        if (physics != NULL)
        {
            tem_dados = 1;
            printf("Assetto Corsa detectado! Enviando telemetria...\n");
        }
    }

    if (!tem_dados)
    {
        printf("AVISO: Assetto Corsa nao encontrado. Enviando dados de teste...\n");
        printf("Inicie o jogo e reinicie este programa.\n");
    }

    char buffer[512];
    int contador = 0;

    while (1)
    {
        if (tem_dados)
        {
            // Dados reais do Assetto Corsa
            sprintf(buffer, "%.2f,%.0f,%d,%.4f,%.4f,%.2f,%.4f,%d,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.4f,%.1f,%.1f,%.1f,%.1f,\n",
                    physics->speedKmh,
                    (float)physics->rpms,
                    physics->gear - 1,
                    physics->gas,
                    physics->brake,
                    physics->fuel,
                    physics->steerAngle,
                    physics->drs,
                    physics->accG[0],
                    physics->accG[1],
                    physics->accG[2],
                    physics->tyreCoreTemp[0],
                    physics->tyreCoreTemp[1],
                    physics->tyreCoreTemp[2],
                    physics->tyreCoreTemp[3],
                    physics->brakeTemp[0],
                    physics->brakeTemp[1],
                    physics->brakeTemp[2],
                    physics->brakeTemp[3],
                    physics->kersCharge,
                    physics->tyreWear[0],
                    physics->tyreWear[1],
                    physics->tyreWear[2],
                    physics->tyreWear[3]);
        }

        // Enviar para o Python
        int bytes_enviados = send(client, buffer, strlen(buffer), 0);
        if (bytes_enviados == SOCKET_ERROR)
        {
            printf("\nConexao perdida com o Python.\n");
            break;
        }

        // TESTES/VISUALIZAÇAO
        if (tem_dados)
        {
            float min_wear_limit = 93.0f; // Piso padrão inicial

            // 2. DENTRO DO LOOP DE TELEMETRIA:
            // Captura os valores de aderência mecânica pura (Grip) de cada pneu
            float grip_w1 = physics->tyreWear[0];
            float grip_w2 = physics->tyreWear[1];
            float grip_w3 = physics->tyreWear[2];
            float grip_w4 = physics->tyreWear[3];

            // Auto-calibração: se você destruir o pneu além do piso padrão, o código se adapta ao carro
            if (grip_w1 < min_wear_limit)
                min_wear_limit = grip_w1;
            if (grip_w2 < min_wear_limit)
                min_wear_limit = grip_w2;
            if (grip_w3 < min_wear_limit)
                min_wear_limit = grip_w3;
            if (grip_w4 < min_wear_limit)
                min_wear_limit = grip_w4;

            // Proteção anti-quebra (se o pneu for 100% indestrutível no servidor, o delta vira 0)
            float delta_escala = 100.0f - min_wear_limit;

            // Variáveis que vão armazenar a conversão para estilo HUD (0% a 100% de borracha)
            float hud_w1, hud_w2, hud_w3, hud_w4;

            if (delta_escala <= 0.0f)
            {
                hud_w1 = hud_w2 = hud_w3 = hud_w4 = 100.0f; // Evita divisão por zero
            }
            else
            {
                // Transforma a janela estreita de aderência na porcentagem visual de vida útil do pneu
                hud_w1 = ((grip_w1 - min_wear_limit) / delta_escala) * 100.0f;
                hud_w2 = ((grip_w2 - min_wear_limit) / delta_escala) * 100.0f;
                hud_w3 = ((grip_w3 - min_wear_limit) / delta_escala) * 100.0f;
                hud_w4 = ((grip_w4 - min_wear_limit) / delta_escala) * 100.0f;
            }

            // 3. O PRINTF CORRIGIDO
            // Substituí os W1...W4 do seu teste pelas variáveis hud_w calculadas com segurança
            printf("Vel: %.2f km/h | Marcha: %d | RPM: %.0f | Acel: %.1f%% | Freio: %.1f%% | W1: %.1f%% W2: %.1f%% W3: %.1f%% W4: %.1f%%\r",
                   physics->speedKmh,
                   physics->gear - 1,
                   (float)physics->rpms,
                   physics->gas * 100.0f,
                   physics->brake * 100.0f,
                   hud_w1, hud_w2, hud_w3, hud_w4); // teste
        }
        else
        {
            printf("Modo teste - sem Assetto Corsa (%d)  \r", contador);
        }
        fflush(stdout);

        contador++;
        Sleep(16);
    }

    // Limpeza
    if (physics)
        UnmapViewOfFile(physics);
    if (hMapFile)
        CloseHandle(hMapFile);
    closesocket(client);
    closesocket(server);
    WSACleanup();

    return 0;
}