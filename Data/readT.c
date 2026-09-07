#include <winsock2.h>
#include <windows.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
#include <wchar.h>
#include <stdlib.h>
#include "assettoLibraryM.h"

static HANDLE open_mapping_any(const char *const *names, size_t count, const char **matchedName)
{
    for (size_t i = 0; i < count; i++)
    {
        HANDLE handle = OpenFileMappingA(FILE_MAP_READ, FALSE, names[i]);
        if (handle != NULL)
        {
            if (matchedName != NULL)
            {
                *matchedName = names[i];
            }
            return handle;
        }
    }

    if (matchedName != NULL)
    {
        *matchedName = NULL;
    }

    return NULL;
}

// Helper: converte wchar_t[15] da struct de graphics para string ASCII no buffer.
// Se AC nao retornou nada util (strings em branco / fora de sessao), usa "--:--.---".
#define LAP_EMPTY "--:--.---"

static void lap_to_ascii(const wchar_t *src, char *dst, int dstSize)
{
    if (src == NULL)
    {
        strncpy(dst, LAP_EMPTY, dstSize - 1);
        dst[dstSize - 1] = '\0';
        return;
    }

    size_t n = wcstombs(dst, src, dstSize - 1);
    if (n == (size_t)-1)
    {
        strncpy(dst, LAP_EMPTY, dstSize - 1);
        dst[dstSize - 1] = '\0';
        return;
    }
    dst[n] = '\0';

    // Remove qualquer espaco/sujeira de borda; se ficou vazio, marca como N/A.
    int somenteEspaco = 1;
    for (int i = 0; dst[i] != '\0'; i++)
    {
        if (dst[i] != ' ' && dst[i] != '\t')
        {
            somenteEspaco = 0;
            break;
        }
    }
    if (somenteEspaco || dst[0] == '\0')
    {
        strncpy(dst, LAP_EMPTY, dstSize - 1);
        dst[dstSize - 1] = '\0';
    }
}

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
    const char *const physicsNames[] = {
        "Local\\acpmf_physics",
        "Local\\acpmw_physics"
    };
    const char *const graphicsNames[] = {
        "Local\\acpmf_graphics",
        "Local\\acpmw_graphics"
    };
    const char *const staticNames[] = {
        "Local\\acpmf_static",
        "Local\\acpmw_static"
    };

    const char *physicsName  = NULL;
    const char *graphicsName = NULL;
    const char *staticName   = NULL;

    HANDLE hMapFile = open_mapping_any(physicsNames, sizeof(physicsNames) / sizeof(physicsNames[0]), &physicsName);
    SPageFilePhysics *physics = NULL;
    int tem_dados = 0;

    // Area GRAPHICS: tempos de volta (currentTime/lastTime/bestTime/split), posicao, status, etc.
    HANDLE hMapGraphic = open_mapping_any(graphicsNames, sizeof(graphicsNames) / sizeof(graphicsNames[0]), &graphicsName);
    SPageFileGraphic *graphics = NULL;
    int tem_graphics = 0;

    // Area STATIC: dados fixos do carro (carModel, maxTorque, maxPower, etc.)
    HANDLE hMapStatic = open_mapping_any(staticNames, sizeof(staticNames) / sizeof(staticNames[0]), &staticName);
    SPageFileStatic *statics = NULL;
    int tem_static = 0;

    if (hMapFile != NULL)
    {
        physics = (SPageFilePhysics *)MapViewOfFile(
            hMapFile, FILE_MAP_READ, 0, 0, sizeof(SPageFilePhysics));

        if (physics != NULL)
        {
            tem_dados = 1;
            printf("Assetto Corsa detectado via %s! Enviando telemetria...\n", physicsName != NULL ? physicsName : "shared memory desconhecida");
        }
    }

    if (hMapGraphic != NULL)
    {
        graphics = (SPageFileGraphic *)MapViewOfFile(
            hMapGraphic, FILE_MAP_READ, 0, 0, sizeof(SPageFileGraphic));

        if (graphics != NULL)
        {
            tem_graphics = 1;
            printf("Assetto Corsa GRAPHICS detectado via %s! Lendo tempos de volta...\n", graphicsName != NULL ? graphicsName : "shared memory desconhecida");
        }
    }

    if (hMapStatic != NULL)
    {
        statics = (SPageFileStatic *)MapViewOfFile(
            hMapStatic, FILE_MAP_READ, 0, 0, sizeof(SPageFileStatic));

        if (statics != NULL)
        {
            tem_static = 1;
            printf("Assetto Corsa STATIC detectado via %s! Lendo dados do carro...\n", staticName != NULL ? staticName : "shared memory desconhecida");
        }
    }

    if (!tem_dados)
    {
        printf("AVISO: Assetto Corsa nao encontrado. Enviando dados de teste...\n");
        printf("Inicie o jogo e reinicie este programa.\n");
    }

    char sCurrent[32], sLast[32], sBest[32], sSplit[32];
    char sCarModel[64];

    char buffer[1024];
    int contador = 0;

    while (1)
    {
        // Tenta reconectar/detectar o Assetto Corsa periodicamente se ainda não conectado
        if ((contador % 60) == 0)
        {
            if (!tem_dados)
            {
                hMapFile = open_mapping_any(physicsNames, sizeof(physicsNames) / sizeof(physicsNames[0]), &physicsName);
                if (hMapFile != NULL)
                {
                    physics = (SPageFilePhysics *)MapViewOfFile(hMapFile, FILE_MAP_READ, 0, 0, sizeof(SPageFilePhysics));
                    if (physics != NULL)
                    {
                        tem_dados = 1;
                        printf("\n[AC] Physics conectado via %s!\n", physicsName != NULL ? physicsName : "shm");
                    }
                }
            }

            if (!tem_graphics)
            {
                hMapGraphic = open_mapping_any(graphicsNames, sizeof(graphicsNames) / sizeof(graphicsNames[0]), &graphicsName);
                if (hMapGraphic != NULL)
                {
                    graphics = (SPageFileGraphic *)MapViewOfFile(hMapGraphic, FILE_MAP_READ, 0, 0, sizeof(SPageFileGraphic));
                    if (graphics != NULL)
                    {
                        tem_graphics = 1;
                        printf("\n[AC] Graphics conectado via %s!\n", graphicsName != NULL ? graphicsName : "shm");
                    }
                }
            }

            if (!tem_static)
            {
                hMapStatic = open_mapping_any(staticNames, sizeof(staticNames) / sizeof(staticNames[0]), &staticName);
                if (hMapStatic != NULL)
                {
                    statics = (SPageFileStatic *)MapViewOfFile(hMapStatic, FILE_MAP_READ, 0, 0, sizeof(SPageFileStatic));
                    if (statics != NULL)
                    {
                        tem_static = 1;
                        printf("\n[AC] Static conectado via %s!\n", staticName != NULL ? staticName : "shm");
                    }
                }
            }
        }

        if (tem_dados && physics != NULL)
        {
            // Dados reais do Assetto Corsa (fisica) + tempos de volta (graphics)
            // Atualiza as strings de tempo a partir da area graphics, se disponivel.
            if (tem_graphics && graphics != NULL)
            {
                lap_to_ascii(graphics->currentTime, sCurrent, sizeof(sCurrent));
                lap_to_ascii(graphics->lastTime,    sLast,    sizeof(sLast));
                lap_to_ascii(graphics->bestTime,    sBest,    sizeof(sBest));
                lap_to_ascii(graphics->split,       sSplit,   sizeof(sSplit));
            }
            else
            {
                strncpy(sCurrent, LAP_EMPTY, sizeof(sCurrent) - 1); sCurrent[sizeof(sCurrent)-1]='\0';
                strncpy(sLast,    LAP_EMPTY, sizeof(sLast)    - 1); sLast[sizeof(sLast)-1]='\0';
                strncpy(sBest,    LAP_EMPTY, sizeof(sBest)    - 1); sBest[sizeof(sBest)-1]='\0';
                strncpy(sSplit,   LAP_EMPTY, sizeof(sSplit)   - 1); sSplit[sizeof(sSplit)-1]='\0';
            }

            int g_completedLaps  = (tem_graphics && graphics) ? graphics->completedLaps : 0;
            int g_position       = (tem_graphics && graphics) ? graphics->position : 0;
            int g_sector         = (tem_graphics && graphics) ? graphics->currentSectorIndex : 0;
            int g_numberOfLaps   = (tem_graphics && graphics) ? graphics->numberOfLaps : 0;
            int g_status         = (tem_graphics && graphics) ? (int)graphics->status : 0;
            int g_session        = (tem_graphics && graphics) ? (int)graphics->session : 0;
            // iLastTime e lastSectorTime: inteiros em ms, mais confiáveis que as strings wchar_t
            int g_iLastTime      = (tem_graphics && graphics) ? graphics->iLastTime : -1;
            int g_lastSectorTime = (tem_graphics && graphics) ? graphics->lastSectorTime : -1;

            // 36 valores de fisica (0..35) + 12 valores de graphics (36..47) + 4 suspensoes (48..51).
            sprintf(buffer,
                "%.2f,%.0f,%d,%.4f,%.4f,%.2f,%.4f,%.2f,%.3f,%.3f,%.3f,"   // 0..10 (11)
                "%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.4f,%.1f,"     // 11..20 (10)
                "%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,"     // 21..30 (10)
                "%.1f,%.1f,%f,%f,%f,"                                     // 31..35 (5)
                "%s,%s,%s,%s,%d,%d,%d,%d,%d,%d,%d,%d,%.2f,%.2f,%.2f,%.2f," // 36..51 (16)
                "%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f", // 52..63 (12)
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
                // 11..14: tyreCoreTemp
                physics->tyreCoreTemp[0],
                physics->tyreCoreTemp[1],
                physics->tyreCoreTemp[2],
                physics->tyreCoreTemp[3],
                // 15..18: brakeTemp
                physics->brakeTemp[0],
                physics->brakeTemp[1],
                physics->brakeTemp[2],
                physics->brakeTemp[3],
                // 19: kersCharge
                physics->kersCharge,
                // 20..23: tyreWear
                physics->tyreWear[0],
                physics->tyreWear[1],
                physics->tyreWear[2],
                physics->tyreWear[3],
                // 24..28: carDamage
                physics->carDamage[0],
                physics->carDamage[1],
                physics->carDamage[2],
                physics->carDamage[3],
                physics->carDamage[4],
                // 29..32: wheelsPressure
                physics->wheelsPressure[0],
                physics->wheelsPressure[1],
                physics->wheelsPressure[2],
                physics->wheelsPressure[3],
                // 33..35: abs, tc, clutch
                physics->abs,
                physics->tc,
                physics->clutch,
                // 36..39: tempos (strings)
                sCurrent,
                sLast,
                sBest,
                sSplit,
                // 40..45: ints da sessao
                g_completedLaps,
                g_position,
                g_sector,
                g_numberOfLaps,
                g_status,
                g_session,
                // 46..47: tempos inteiros em ms (mais confiáveis)
                g_iLastTime,
                g_lastSectorTime,
                // 48..51: suspensão
                physics->suspensionTravel[0],
                physics->suspensionTravel[1],
                physics->suspensionTravel[2],
                physics->suspensionTravel[3],
                // 52..63: tyreTempI, tyreTempM, tyreTempO
                physics->tyreTempI[0], physics->tyreTempI[1], physics->tyreTempI[2], physics->tyreTempI[3],
                physics->tyreTempM[0], physics->tyreTempM[1], physics->tyreTempM[2], physics->tyreTempM[3],
                physics->tyreTempO[0], physics->tyreTempO[1], physics->tyreTempO[2], physics->tyreTempO[3]);

            // -------- Dados Estaticos + Ambiente (64..79) --------
            // Converte carModel de wchar_t para ASCII
            if (tem_static && statics != NULL)
            {
                size_t n = wcstombs(sCarModel, statics->carModel, sizeof(sCarModel) - 1);
                if (n == (size_t)-1) sCarModel[0] = '\0';
                else {
                    sCarModel[n] = '\0';
                    // Remove vírgulas se houver no nome do modelo
                    for (size_t i = 0; sCarModel[i] != '\0'; i++) {
                        if (sCarModel[i] == ',') sCarModel[i] = ' ';
                    }
                }
            }
            else
            {
                sCarModel[0] = '\0';
            }

            float s_maxTorque          = (tem_static && statics) ? statics->maxTorque          : 0.0f;
            float s_maxPower           = (tem_static && statics) ? statics->maxPower            : 0.0f;
            int   s_maxRpm             = (tem_static && statics) ? statics->maxRpm              : 0;
            float s_maxFuel            = (tem_static && statics) ? statics->maxFuel             : 0.0f;
            float s_suspMaxFL          = (tem_static && statics) ? statics->suspensionMaxTravel[0] : 0.0f;
            float s_suspMaxFR          = (tem_static && statics) ? statics->suspensionMaxTravel[1] : 0.0f;
            float s_suspMaxRL          = (tem_static && statics) ? statics->suspensionMaxTravel[2] : 0.0f;
            float s_suspMaxRR          = (tem_static && statics) ? statics->suspensionMaxTravel[3] : 0.0f;
            float s_maxTurboBoost      = (tem_static && statics) ? statics->maxTurboBoost       : 0.0f;
            int   s_hasDRS             = (tem_static && statics) ? statics->hasDRS              : 0;
            int   s_hasERS             = (tem_static && statics) ? statics->hasERS              : 0;
            int   s_hasKERS            = (tem_static && statics) ? statics->hasKERS             : 0;
            float s_surfaceGrip        = (tem_graphics && graphics) ? graphics->surfaceGrip     : 0.0f;
            float s_windSpeed          = (tem_graphics && graphics) ? graphics->windSpeed        : 0.0f;
            float s_windDirection      = (tem_graphics && graphics) ? graphics->windDirection    : 0.0f;

            // Concatena campos 64..79 ao buffer
            char extraBuf[256];
            snprintf(extraBuf, sizeof(extraBuf),
                ",%s,%.2f,%.2f,%d,%.2f,%.4f,%.4f,%.4f,%.4f,%.4f,%d,%d,%d,%.4f,%.2f,%.2f,%.4f,%.4f\n",
                sCarModel,          // 64
                s_maxTorque,        // 65
                s_maxPower,         // 66
                s_maxRpm,           // 67
                s_maxFuel,          // 68
                s_suspMaxFL,        // 69
                s_suspMaxFR,        // 70
                s_suspMaxRL,        // 71
                s_suspMaxRR,        // 72
                s_maxTurboBoost,    // 73
                s_hasDRS,           // 74
                s_hasERS,           // 75
                s_hasKERS,          // 76
                s_surfaceGrip,      // 77
                s_windSpeed,        // 78
                s_windDirection,    // 79
                physics->rideHeight[0], // 80
                physics->rideHeight[1]); // 81

            strncat(buffer, extraBuf, sizeof(buffer) - strlen(buffer) - 1);
        }
        else
        {
            // Modo teste: 64 zeros/N/A (0..63) + 16 campos estaticos/ambiente (64..79) + 2 rideHeight (80..81)
            sprintf(buffer,
                "0.00,0,0,0.0000,0.0000,0.00,0.0000,0.00,0.000,0.000,0.000,"
                "0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0000,0.0,"
                "0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,"
                "0.0,0.0,0.000000,0.000000,0.000000,"
                "%s,%s,%s,%s,0,0,0,0,0,0,-1,-1,0.00,0.00,0.00,0.00,"
                "0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,"
                "TEST_CAR,0.00,0.00,0,0.00,0.0000,0.0000,0.0000,0.0000,0.0000,0,0,0,0.0000,0.00,0.00,0.00,0.00\n",
                LAP_EMPTY, LAP_EMPTY, LAP_EMPTY, LAP_EMPTY);
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
            printf("\rSusT: %.2f, %.2f, %.2f, %.2f        ", (physics->suspensionTravel[0] * 100), physics->suspensionTravel[1], physics->suspensionTravel[2], physics->suspensionTravel[3]); // teste
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
    if (graphics)
        UnmapViewOfFile(graphics);
    if (hMapGraphic)
        CloseHandle(hMapGraphic);
    if (statics)
        UnmapViewOfFile(statics);
    if (hMapStatic)
        CloseHandle(hMapStatic);
    closesocket(client);
    closesocket(server);
    WSACleanup();

    return 0;
}