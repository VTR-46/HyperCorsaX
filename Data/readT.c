#include <winsock2.h>
#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
#include "assettoLibraryM.h"

int main()
{
    //Winsock
    WSADATA wsa;
    WSAStartup(MAKEWORD(2, 2), &wsa);
    
    // socket
    SOCKET server = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(5000);
    addr.sin_addr.s_addr = INADDR_ANY;
    
    bind(server, (struct sockaddr*)&addr, sizeof(addr));
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
            sprintf(buffer, "%.2f,%.0f,%d,%.4f,%.4f,%.2f,%.4f,%d,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f,%.1f\n",
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
                    physics->TyreCoreTemp[0],
                    physics->TyreCoreTemp[1],
                    physics->TyreCoreTemp[2],
                    physics->TyreCoreTemp[3]);
        }

        // Enviar para o Python
        int bytes_enviados = send(client, buffer, strlen(buffer), 0);
        if (bytes_enviados == SOCKET_ERROR)
        {
            printf("\nConexao perdida com o Python.\n");
            break;
        }
        

        if (tem_dados)
        {
            printf("Vel: %.2f km/h | Marcha: %d | RPM: %.0f | Acel: %.1f%% | Freio: %.1f%% | Comb: %.1fL  \r",
                   physics->speedKmh, physics->gear - 1, (float)physics->rpms,
                   physics->gas * 100, physics->brake * 100, physics->fuel);
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
    if (physics) UnmapViewOfFile(physics);
    if (hMapFile) CloseHandle(hMapFile);
    closesocket(client);
    closesocket(server);
    WSACleanup();
    
    return 0;
}