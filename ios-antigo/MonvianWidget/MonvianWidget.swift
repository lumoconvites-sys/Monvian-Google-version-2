//
//  MonvianWidget.swift
//  MonvianWidgetExtension
//
//  Widget Dinâmico Nativo do Monvian para iPhone (iOS 17+ / WidgetKit / SwiftUI)
//  Formato: Large Widget (systemLarge — 2 × 2 ícones)
//

import WidgetKit
import SwiftUI

// MARK: - 1. Modelo de Dados Sincronizado com o Banco de Dados do Monvian

struct MonvianWidgetSpot: Codable, Identifiable, Hashable {
    let position: Int
    let spotId: String
    let stepId: String
    let name: String
    let shortDescription: String
    let image: String
    let categoryLabel: String
    let deepLinkUrl: String

    var id: String { spotId }
}

struct MonvianWidgetResponse: Codable {
    let success: Bool
    let widget: MonvianWidgetPayload
}

struct MonvianWidgetPayload: Codable {
    let widgetTitle: String
    let itineraryId: String
    let itineraryTitle: String
    let daysCount: Int
    let totalStopsCount: Int
    let deepLinkUrl: String
    let updatedAt: String
    let spots: [MonvianWidgetSpot]
}

// MARK: - 2. Timeline Entry com Cache de Imagens Síncrono para WidgetKit

struct MonvianWidgetEntry: TimelineEntry {
    let date: Date
    let payload: MonvianWidgetPayload
    let cachedImages: [String: Data]
}

// MARK: - 3. App Group & Cache Local (Suporte Offline + Atualização Instantânea)

enum MonvianWidgetStorage {
    static let appGroupId = "group.com.monvian.app"
    static let payloadKey = "monvian_widget_payload_v1"
    static let apiBaseURL = "https://monvian.app"

    static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    static func savePayload(_ payload: MonvianWidgetPayload) {
        guard let data = try? JSONEncoder().encode(payload) else { return }
        sharedDefaults?.set(data, forKey: payloadKey)
    }

    static func loadCachedPayload() -> MonvianWidgetPayload {
        if let data = sharedDefaults?.data(forKey: payloadKey),
           let decoded = try? JSONDecoder().decode(MonvianWidgetPayload.self, from: data),
           !decoded.spots.isEmpty {
            return decoded
        }
        return defaultFallbackPayload()
    }

    static func cacheImageData(_ data: Data, for spotId: String) {
        sharedDefaults?.set(data, forKey: "spot_img_\(spotId)")
    }

    static func loadCachedImageData(for spotId: String) -> Data? {
        sharedDefaults?.data(forKey: "spot_img_\(spotId)")
    }

    static func defaultFallbackPayload() -> MonvianWidgetPayload {
        MonvianWidgetPayload(
            widgetTitle: "Vamos começar sua jornada?",
            itineraryId: "roteiro-bate-volta-essencial",
            itineraryTitle: "Bate-e-Volta: O Melhor de Campos em 24h",
            daysCount: 1,
            totalStopsCount: 3,
            deepLinkUrl: "monvian://roteiros?widget_itinerary=roteiro-bate-volta-essencial",
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            spots: [
                MonvianWidgetSpot(
                    position: 1,
                    spotId: "portal-de-campos-do-jordao",
                    stepId: "step-1",
                    name: "Portal de Campos do Jordão",
                    shortDescription: "Início da sua aventura",
                    image: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=600&q=80",
                    categoryLabel: "Cartão Postal",
                    deepLinkUrl: "monvian://roteiros?widget_itinerary=roteiro-bate-volta-essencial&widget_spot=portal-de-campos-do-jordao"
                ),
                MonvianWidgetSpot(
                    position: 2,
                    spotId: "villa-fenix",
                    stepId: "step-2",
                    name: "Vila Capivari",
                    shortDescription: "O coração da cidade",
                    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
                    categoryLabel: "Vila Gastronômica",
                    deepLinkUrl: "monvian://roteiros?widget_itinerary=roteiro-bate-volta-essencial&widget_spot=villa-fenix"
                ),
                MonvianWidgetSpot(
                    position: 3,
                    spotId: "parque-capivari",
                    stepId: "step-3",
                    name: "Parque Capivari",
                    shortDescription: "Diversão para todos",
                    image: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=600&q=80",
                    categoryLabel: "Atração / Turístico",
                    deepLinkUrl: "monvian://roteiros?widget_itinerary=roteiro-bate-volta-essencial&widget_spot=parque-capivari"
                )
            ]
        )
    }
}

// MARK: - 4. TimelineProvider com Sincronização Automática da API do Monvian

struct MonvianTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> MonvianWidgetEntry {
        let payload = MonvianWidgetStorage.loadCachedPayload()
        return MonvianWidgetEntry(date: Date(), payload: payload, cachedImages: [:])
    }

    func getSnapshot(in context: Context, completion: @escaping (MonvianWidgetEntry) -> Void) {
        let payload = MonvianWidgetStorage.loadCachedPayload()
        var images: [String: Data] = [:]
        for spot in payload.spots.prefix(3) {
            if let cached = MonvianWidgetStorage.loadCachedImageData(for: spot.spotId) {
                images[spot.spotId] = cached
            }
        }
        completion(MonvianWidgetEntry(date: Date(), payload: payload, cachedImages: images))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MonvianWidgetEntry>) -> Void) {
        Task {
            let activeItineraryId = MonvianWidgetStorage.sharedDefaults?.string(forKey: "monvian_active_itinerary_id") ?? ""
            let sessionId = MonvianWidgetStorage.sharedDefaults?.string(forKey: "monvian_itinerary_session") ?? ""

            var urlComponents = URLComponents(string: "\(MonvianWidgetStorage.apiBaseURL)/api/widget/itinerary")
            var queryItems: [URLQueryItem] = []
            if !activeItineraryId.isEmpty {
                queryItems.append(URLQueryItem(name: "itineraryId", value: activeItineraryId))
            }
            if !sessionId.isEmpty {
                queryItems.append(URLQueryItem(name: "sessionId", value: sessionId))
            }
            urlComponents?.queryItems = queryItems.isEmpty ? nil : queryItems

            var resolvedPayload = MonvianWidgetStorage.loadCachedPayload()

            if let url = urlComponents?.url {
                var request = URLRequest(url: url)
                request.timeoutInterval = 8
                if !sessionId.isEmpty {
                    request.setValue(sessionId, forHTTPHeaderField: "x-session-id")
                }

                if let (data, response) = try? await URLSession.shared.data(for: request),
                   let httpResp = response as? HTTPURLResponse,
                   httpResp.statusCode == 200,
                   let decoded = try? JSONDecoder().decode(MonvianWidgetResponse.self, from: data),
                   !decoded.widget.spots.isEmpty {
                    resolvedPayload = decoded.widget
                    MonvianWidgetStorage.savePayload(resolvedPayload)
                }
            }

            // Pré-carregar e armazenar em cache as fotos reais dos 3 pontos turísticos
            var imageMap: [String: Data] = [:]
            for spot in resolvedPayload.spots.prefix(3) {
                if let imgURL = URL(string: spot.image),
                   let (imgData, _) = try? await URLSession.shared.data(from: imgURL) {
                    imageMap[spot.spotId] = imgData
                    MonvianWidgetStorage.cacheImageData(imgData, for: spot.spotId)
                } else if let cached = MonvianWidgetStorage.loadCachedImageData(for: spot.spotId) {
                    imageMap[spot.spotId] = cached
                }
            }

            let entry = MonvianWidgetEntry(
                date: Date(),
                payload: resolvedPayload,
                cachedImages: imageMap
            )

            // Atualiza automaticamente a cada 15 minutos ou imediatamente via WidgetCenter.shared.reloadAllTimelines()
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

// MARK: - 5. Componente Gráfico Superior (Linha de Rota Curva + 4 Pontos + Pin Preto)

struct MonvianRouteHeaderGraphic: View {
    var body: some View {
        ZStack {
            // Linha ondulada cinza suave com 4 pontos de rota
            Canvas { context, size in
                let w = size.width
                let h = size.height

                var path = Path()
                path.move(to: CGPoint(x: w * 0.04, y: h * 0.72))
                path.addCurve(
                    to: CGPoint(x: w * 0.34, y: h * 0.36),
                    control1: CGPoint(x: w * 0.16, y: h * 0.78),
                    control2: CGPoint(x: w * 0.24, y: h * 0.34)
                )
                path.addCurve(
                    to: CGPoint(x: w * 0.56, y: h * 0.76),
                    control1: CGPoint(x: w * 0.42, y: h * 0.38),
                    control2: CGPoint(x: w * 0.48, y: h * 0.76)
                )
                path.addCurve(
                    to: CGPoint(x: w * 0.80, y: h * 0.28),
                    control1: CGPoint(x: w * 0.65, y: h * 0.76),
                    control2: CGPoint(x: w * 0.71, y: h * 0.28)
                )
                path.addCurve(
                    to: CGPoint(x: w * 0.96, y: h * 0.58),
                    control1: CGPoint(x: w * 0.87, y: h * 0.28),
                    control2: CGPoint(x: w * 0.92, y: h * 0.46)
                )

                context.stroke(
                    path,
                    with: .color(Color(red: 0.89, green: 0.89, blue: 0.91)),
                    style: StrokeStyle(lineWidth: 2.5, lineCap: .round)
                )

                let dots: [CGPoint] = [
                    CGPoint(x: w * 0.16, y: h * 0.65),
                    CGPoint(x: w * 0.31, y: h * 0.37),
                    CGPoint(x: w * 0.60, y: h * 0.74),
                    CGPoint(x: w * 0.81, y: h * 0.28)
                ]

                for pt in dots {
                    let rect = CGRect(x: pt.x - 4.2, y: pt.y - 4.2, width: 8.4, height: 8.4)
                    context.fill(Path(ellipseIn: rect), with: .color(Color(red: 0.74, green: 0.74, blue: 0.76)))
                }
            }
            .frame(height: 44)

            // Pin de localização preto central com sombra elíptica suave
            VStack(spacing: 1) {
                Image(systemName: "mappin.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 30, height: 34)
                    .foregroundStyle(Color(red: 0.06, green: 0.06, blue: 0.07))

                Ellipse()
                    .fill(Color.black.opacity(0.14))
                    .frame(width: 18, height: 3.5)
                    .blur(radius: 1.2)
            }
            .offset(y: -2)
        }
    }
}

// MARK: - 6. View Principal do Widget Grande (2x2)

struct MonvianWidgetEntryView: View {
    var entry: MonvianTimelineProvider.Entry

    var body: some View {
        VStack(spacing: 0) {
            // Ilustração de Rota + Pin
            MonvianRouteHeaderGraphic()
                .padding(.top, 2)

            // Frase Principal em SF Pro Display Bold
            Text("Vamos começar\nsua jornada?")
                .font(.system(size: 22, weight: .bold, design: .default))
                .tracking(-0.4)
                .foregroundColor(.black)
                .multilineTextAlignment(.center)
                .lineSpacing(1)
                .padding(.top, 4)
                .padding(.bottom, 12)

            // Lista dos 3 Primeiros Pontos Turísticos Reais
            VStack(spacing: 0) {
                ForEach(Array(entry.payload.spots.prefix(3).enumerated()), id: \.element.id) { index, spot in
                    if let destinationURL = URL(string: spot.deepLinkUrl) {
                        Link(destination: destinationURL) {
                            spotRow(spot: spot)
                        }
                    } else {
                        spotRow(spot: spot)
                    }

                    if index < min(entry.payload.spots.count, 3) - 1 {
                        Divider()
                            .background(Color(red: 0.92, green: 0.92, blue: 0.94))
                            .padding(.vertical, 7)
                    }
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .widgetURL(URL(string: entry.payload.deepLinkUrl))
        .containerBackground(for: .widget) {
            Color.white
        }
    }

    @ViewBuilder
    private func spotRow(spot: MonvianWidgetSpot) -> some View {
        HStack(spacing: 11) {
            // Foto Real do Ponto Turístico com Cantos Arredondados
            Group {
                if let data = entry.cachedImages[spot.spotId],
                   let uiImage = UIImage(data: data) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } else {
                    Color(red: 0.95, green: 0.95, blue: 0.97)
                }
            }
            .frame(width: 52, height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

            // Número da Posição no Roteiro (1, 2, 3)
            ZStack {
                Circle()
                    .fill(Color(red: 0.949, green: 0.949, blue: 0.969))
                    .frame(width: 27, height: 27)

                Text("\(spot.position)")
                    .font(.system(size: 13.5, weight: .bold, design: .default))
                    .foregroundColor(.black)
            }

            // Nome do Estabelecimento e Breve Descrição
            VStack(alignment: .leading, spacing: 2) {
                Text(spot.name)
                    .font(.system(size: 14.5, weight: .bold, design: .default))
                    .tracking(-0.2)
                    .foregroundColor(.black)
                    .lineLimit(1)

                Text(spot.shortDescription)
                    .font(.system(size: 12.5, weight: .regular, design: .default))
                    .foregroundColor(Color(red: 0.43, green: 0.43, blue: 0.45))
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
    }
}

// MARK: - 7. Configuração do WidgetKit (.systemLarge)

@main
struct MonvianWidget: Widget {
    let kind: String = "MonvianDynamicItineraryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MonvianTimelineProvider()) { entry in
            MonvianWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Jornada Monvian")
        .description("Acompanhe os 3 primeiros pontos turísticos do seu roteiro principal em Campos do Jordão.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}
